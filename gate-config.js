window.PORTAL_GATE = {
  users: {
    "rh@grupotka.com.br": {
      passwordHash: {
        algorithm: "PBKDF2-SHA256",
        iterations: 210000,
        salt: "F+StSZW0s0Ti5/ibisVupg==",
        hash: "bHFqhhWA1xNIe6RzVyD8U68zKv95MPt3F6JyItc39BE="
      },
      sector: "rh",
      permissions: {
        rh: true,
        monitoramento: false,
        operacional: false,
        estrutural: false,
        logs: true,
        admin: false
      }
    },
    "supervisao@grupotka.com.br": {
      passwordHash: {
        algorithm: "PBKDF2-SHA256",
        iterations: 210000,
        salt: "8CY3miAvrPLwGHj22FQRFA==",
        hash: "V78qDwpTnyF6ml34S4KU/PrxKpZIclbrrUwc8IQklIo="
      },
      sector: "operacional",
      permissions: {
        rh: false,
        monitoramento: false,
        operacional: true,
        estrutural: false,
        logs: true,
        admin: false
      }
    },
    "coordenacao@grupotka.com.br": {
      passwordHash: {
        algorithm: "PBKDF2-SHA256",
        iterations: 210000,
        salt: "+6Wmc4UziXys1feJ/Mcp/g==",
        hash: "PHq3d2xH88JvUzkPOX2LZbwimiIf3rragCKnywo4aF8="
      },
      sector: "operacional",
      permissions: {
        rh: true,
        monitoramento: true,
        operacional: true,
        estrutural: false,
        logs: true,
        admin: false
      }
    },
    "comercial@grupotka.com.br": {
      passwordHash: {
        algorithm: "PBKDF2-SHA256",
        iterations: 210000,
        salt: "apfPbx3dgcjbXrABP9DbaQ==",
        hash: "WpYmdCdx1bKSW/4ypfvD6+9T+XRlFN8XYzKnESeKh9I="
      },
      sector: "administrativo",
      permissions: {
        rh: true,
        monitoramento: true,
        operacional: true,
        estrutural: true,
        logs: true,
        admin: true
      }
    },
    "adminteste@grupotka.com.br": {
      passwordHash: {
        algorithm: "PBKDF2-SHA256",
        iterations: 210000,
        salt: "z+aSdGZkmkiEnW0bsMPsTA==",
        hash: "QvDQTJX7+ZGglx72oLyE0tUGPIH5uCOvXVyUhHORgqk="
      },
      sector: "administrativo",
      permissions: {
        rh: true,
        monitoramento: true,
        operacional: true,
        estrutural: true,
        logs: false,
        admin: true,
        skipAuditLogs: true,
        canUndo: true,
        testingMode: true
      }
    },
    "monitoramento@grupotka.com.br": {
      passwordHash: {
        algorithm: "PBKDF2-SHA256",
        iterations: 210000,
        salt: "UHT/KqLDvNweOFu3khP1aw==",
        hash: "JKfAmd9vljyaMqCkY+GZsWnBkFRz2wNhFQ1Iq0iOElU="
      },
      sector: "monitoramento",
      permissions: {
        rh: false,
        monitoramento: true,
        operacional: false,
        estrutural: false,
        logs: true,
        admin: false
      }
    }
  }
};
