(function () {
  function text(value) {
    return String(value || "").trim();
  }

  function getByPath(source, path) {
    return path.split(".").reduce(function (value, key) {
      return value == null ? "" : value[key];
    }, source);
  }

  function hasAnyDependentData(item) {
    return Boolean(
      text(item && item.name) ||
      text(item && item.relationship) ||
      text(item && item.birthDate) ||
      text(item && item.cpf)
    );
  }

  function requiredIssues(state) {
    var issues = [];
    var requiredFields = [
      ["personal.fullName", "Nome completo"],
      ["personal.phone", "Telefone"],
      ["personal.email", "E-mail"],
      ["personal.motherName", "Nome da mae"],
      ["personal.birthDate", "Data de nascimento"],
      ["address.street", "Endereco"],
      ["address.number", "Numero"],
      ["address.cep", "CEP"],
      ["documents.workCardNumber", "Carteira de trabalho"],
      ["documents.cpf", "CPF"],
      ["documents.pisPasep", "PIS"],
      ["employment.educationLevel", "Grau de escolaridade"],
      ["employment.maritalStatus", "Estado civil"],
      ["employment.pixKey", "Chave Pix"],
      ["employment.bank", "Banco"],
      ["lgpd.name", "Nome LGPD"],
      ["lgpd.place", "Local LGPD"],
      ["lgpd.date", "Data LGPD"]
    ];

    requiredFields.forEach(function (item) {
      if (!text(getByPath(state, item[0]))) issues.push(item[1]);
    });

    (state.dependents || []).forEach(function (dependent, index) {
      if (!hasAnyDependentData(dependent)) return;
      if (!text(dependent.name)) issues.push("Dependente " + (index + 1) + " - Nome");
      if (!text(dependent.relationship)) issues.push("Dependente " + (index + 1) + " - Parentesco");
      if (!text(dependent.birthDate)) issues.push("Dependente " + (index + 1) + " - Data de nascimento");
      if (!text(dependent.cpf)) issues.push("Dependente " + (index + 1) + " - CPF");
    });

    return issues;
  }

  function isComplete(state) {
    return requiredIssues(state).length === 0 &&
      Boolean(text(getByPath(state, "meta.publicSubmittedAt"))) &&
      Boolean(getByPath(state, "lgpd.agreement")) &&
      Boolean(text(getByPath(state, "finalSignature.signatureDataUrl"))) &&
      (getByPath(state, "transport.decision") === "accept" || getByPath(state, "transport.decision") === "decline");
  }

  window.TKAAdmissionRules = {
    requiredIssues: requiredIssues,
    isComplete: isComplete,
    hasAnyDependentData: hasAnyDependentData
  };
})();
