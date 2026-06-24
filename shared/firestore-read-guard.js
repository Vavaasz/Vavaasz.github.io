(function () {
  const BACKOFF_KEY = "tka_firestore_read_backoff_until_v2";
  const REASON_KEY = "tka_firestore_read_backoff_reason_v2";
  const QUOTA_BACKOFF_MS = 15 * 60 * 1000;
  const ERROR_BACKOFF_MS = 2 * 60 * 1000;

  function now() {
    return Date.now();
  }

  function readBackoffUntil() {
    try {
      return Number(localStorage.getItem(BACKOFF_KEY) || 0);
    } catch {
      return 0;
    }
  }

  function writeBackoff(reason) {
    const duration = reason === "quota" ? QUOTA_BACKOFF_MS : ERROR_BACKOFF_MS;
    const until = now() + duration;
    try {
      localStorage.setItem(BACKOFF_KEY, String(until));
      localStorage.setItem(REASON_KEY, reason || "error");
    } catch {}
    return until;
  }

  function clearBackoff() {
    try {
      localStorage.removeItem(BACKOFF_KEY);
      localStorage.removeItem(REASON_KEY);
    } catch {}
  }

  function errorText(error) {
    return [
      error && error.code,
      error && error.name,
      error && error.message,
      error && error.status
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function readErrorReason(error) {
    const text = errorText(error);
    if (text.includes("resource-exhausted") || text.includes("quota") || text.includes("429")) return "quota";
    if (text.includes("deadline") || text.includes("unavailable") || text.includes("timeout")) return "error";
    return "";
  }

  function backoffActive() {
    const until = readBackoffUntil();
    if (!until) return false;
    if (until <= now()) {
      clearBackoff();
      return false;
    }
    return true;
  }

  function pausedError() {
    const error = new Error("Firestore reads paused temporarily after a recent quota or timeout error.");
    error.code = "resource-exhausted";
    error.tkaFirestoreReadGuard = true;
    return error;
  }

  function noteReadResult(error) {
    if (!error) {
      clearBackoff();
      return;
    }
    const reason = readErrorReason(error);
    if (reason) writeBackoff(reason);
  }

  function guardReference(ref) {
    if (!ref || ref.__tkaFirestoreReadGuard) return ref;
    try {
      Object.defineProperty(ref, "__tkaFirestoreReadGuard", { value: true });
    } catch {
      return ref;
    }

    ["collection", "doc", "where", "orderBy", "limit", "startAt", "startAfter", "endAt", "endBefore"].forEach(function (method) {
      if (typeof ref[method] !== "function") return;
      const original = ref[method].bind(ref);
      ref[method] = function () {
        return guardReference(original.apply(null, arguments));
      };
    });

    if (typeof ref.get === "function") {
      const originalGet = ref.get.bind(ref);
      ref.get = function () {
        if (backoffActive()) return Promise.reject(pausedError());
        return originalGet.apply(null, arguments).then(function (snapshot) {
          noteReadResult(null);
          return snapshot;
        }, function (error) {
          noteReadResult(error);
          throw error;
        });
      };
    }

    if (typeof ref.onSnapshot === "function") {
      const originalOnSnapshot = ref.onSnapshot.bind(ref);
      ref.onSnapshot = function () {
        const args = Array.prototype.slice.call(arguments);
        const errorHandler = args.find(function (item, index) {
          return index > 0 && typeof item === "function";
        });
        if (backoffActive()) {
          const error = pausedError();
          setTimeout(function () {
            if (typeof errorHandler === "function") errorHandler(error);
            else console.warn(error.message);
          }, 0);
          return function unsubscribe() {};
        }
        const wrappedArgs = args.slice();
        const lastFunctionIndex = wrappedArgs.map(function (item, index) {
          return typeof item === "function" ? index : -1;
        }).filter(function (index) {
          return index >= 0;
        }).pop();
        if (lastFunctionIndex > 0) {
          const originalErrorHandler = wrappedArgs[lastFunctionIndex];
          wrappedArgs[lastFunctionIndex] = function (error) {
            noteReadResult(error);
            return originalErrorHandler(error);
          };
        }
        try {
          return originalOnSnapshot.apply(null, wrappedArgs);
        } catch (error) {
          noteReadResult(error);
          throw error;
        }
      };
    }

    return ref;
  }

  function guardDb(db) {
    if (!db || db.__tkaFirestoreReadGuard) return db;
    try {
      Object.defineProperty(db, "__tkaFirestoreReadGuard", { value: true });
    } catch {
      return db;
    }

    if (typeof db.collection === "function") {
      const originalCollection = db.collection.bind(db);
      db.collection = function () {
        return guardReference(originalCollection.apply(null, arguments));
      };
    }
    if (typeof db.doc === "function") {
      const originalDoc = db.doc.bind(db);
      db.doc = function () {
        return guardReference(originalDoc.apply(null, arguments));
      };
    }
    if (typeof db.runTransaction === "function") {
      const originalRunTransaction = db.runTransaction.bind(db);
      db.runTransaction = function () {
        if (backoffActive()) return Promise.reject(pausedError());
        return originalRunTransaction.apply(null, arguments).then(function (result) {
          noteReadResult(null);
          return result;
        }, function (error) {
          noteReadResult(error);
          throw error;
        });
      };
    }
    return db;
  }

  function install() {
    const firebase = window.firebase;
    if (!firebase || typeof firebase.firestore !== "function" || firebase.firestore.__tkaFirestoreReadGuard) return false;
    const originalFirestore = firebase.firestore.bind(firebase);
    function guardedFirestore() {
      return guardDb(originalFirestore.apply(null, arguments));
    }
    Object.keys(firebase.firestore).forEach(function (key) {
      guardedFirestore[key] = firebase.firestore[key];
    });
    ["FieldValue", "Timestamp", "Blob", "GeoPoint", "DocumentReference", "CollectionReference"].forEach(function (key) {
      if (firebase.firestore[key]) guardedFirestore[key] = firebase.firestore[key];
    });
    guardedFirestore.__tkaFirestoreReadGuard = true;
    firebase.firestore = guardedFirestore;
    return true;
  }

  window.TKAFirestoreReadGuard = {
    install,
    backoffActive,
    readBackoffUntil,
    writeBackoff,
    clearBackoff
  };

  if (!install()) {
    let attempts = 0;
    const timer = setInterval(function () {
      attempts += 1;
      if (install() || attempts > 50) clearInterval(timer);
    }, 50);
  }
})();
