export interface ValidacionId {
  valido: boolean;
  tipo: string;
  mensaje: string;
  provincia?: string;
  esPersonaNatural?: boolean;
}

const PROVINCIAS_DPA: Record<string, string> = {
  "01": "Azuay", "02": "Bolívar", "03": "Cañar", "04": "Carchi",
  "05": "Cotopaxi", "06": "El Oro", "07": "Esmeraldas", "08": "Galápagos",
  "09": "Guayas", "10": "Imbabura", "11": "Loja", "12": "Los Ríos",
  "13": "Manabí", "14": "Morona Santiago", "15": "Napo", "16": "Pastaza",
  "17": "Pichincha", "18": "Santa Elena", "19": "Santo Domingo de los Tsáchilas",
  "20": "Sucumbíos", "21": "Tungurahua", "22": "Zamora Chinchipe",
};

export const CIUDADES_PRINCIPALES = [
  { ciudad: "Quito", provincia: "Pichincha" },
  { ciudad: "Ambato", provincia: "Tungurahua" },
  { ciudad: "Guayaquil", provincia: "Guayas" },
  { ciudad: "Cuenca", provincia: "Azuay" },
  { ciudad: "Riobamba", provincia: "Chimborazo" },
  { ciudad: "Latacunga", provincia: "Cotopaxi" },
  { ciudad: "Machala", provincia: "El Oro" },
  { ciudad: "Santo Domingo", provincia: "Santo Domingo de los Tsáchilas" },
  { ciudad: "Ibarra", provincia: "Imbabura" },
  { ciudad: "Manta", provincia: "Manabí" },
  { ciudad: "Loja", provincia: "Loja" },
  { ciudad: "Esmeraldas", provincia: "Esmeraldas" },
];

function validarCedulaBase(d: number[]): boolean {
  const prov = d[0] * 10 + d[1];
  if (prov < 1 || prov > 24) return false;
  if (d[2] > 5) return false;
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let p = coef[i] * d[i];
    if (p > 9) p -= 9;
    sum += p;
  }
  const verif = sum % 10 === 0 ? 0 : 10 - (sum % 10);
  return verif === d[9];
}

export function validarIdentidad(input: string): ValidacionId {
  const clean = (input || "").trim();
  if (!/^\d{10,13}$/.test(clean)) {
    return { valido: false, tipo: "-", mensaje: "Debe tener entre 10 y 13 dígitos numéricos." };
  }
  const d = clean.split("").map(Number);
  const provCode = clean.slice(0, 2);
  const provincia = PROVINCIAS_DPA[provCode] ?? "Provincia inválida";
  const tercerDigito = d[2];

  if (clean.length === 13) {
    // RUC
    if (!clean.endsWith("001") && !clean.endsWith("0001")) {
      return {
        valido: false, tipo: "RUC", mensaje:
          "Los últimos 3 dígitos deben ser el número de establecimiento (usualmente 001).",
        provincia,
      };
    }
    if (tercerDigito < 6) {
      // RUC persona natural
      const ok = validarCedulaBase(d.slice(0, 10).concat([d[9]]));
      return {
        valido: ok,
        tipo: "RUC Persona Natural",
        mensaje: ok
          ? "Válido. RUC de persona natural."
          : "Dígito verificador incorrecto para RUC de persona natural.",
        provincia,
        esPersonaNatural: ok,
      };
    }
    if (tercerDigito === 9) {
      // RUC sociedad privada / jurídica
      const coef = [4, 3, 2, 7, 6, 5, 4, 3, 2];
      let sum = 0;
      for (let i = 0; i < 9; i++) sum += coef[i] * d[i];
      const res = sum % 11;
      const verif = res === 0 ? 0 : 11 - res;
      const ok = verif === d[9];
      return {
        valido: ok,
        tipo: "RUC Sociedad/Jurídica",
        mensaje: ok
          ? "Válido. RUC de persona jurídica (sociedad)."
          : "Dígito verificador incorrecto para RUC jurídico.",
        provincia,
        esPersonaNatural: false,
      };
    }
    if (tercerDigito === 6) {
      // RUC entidad pública
      const coef = [3, 2, 7, 6, 5, 4, 3, 2];
      let sum = 0;
      for (let i = 0; i < 8; i++) sum += coef[i] * d[i];
      const res = sum % 11;
      const verif = res === 0 ? 0 : 11 - res;
      const ok = verif === d[8];
      return {
        valido: ok,
        tipo: "RUC Entidad Pública",
        mensaje: ok
          ? "Válido. RUC de entidad pública."
          : "Dígito verificador incorrecto para RUC de entidad pública.",
        provincia,
        esPersonaNatural: false,
      };
    }
    return { valido: false, tipo: "RUC", mensaje: "Tercer dígito inválido para RUC.", provincia };
  }

  if (clean.length === 10) {
    if (tercerDigito > 5) {
      return {
        valido: false, tipo: "Cédula/RUC",
        mensaje: "Tercer dígito > 5 corresponde a sociedades: use un RUC de 13 dígitos.",
        provincia,
      };
    }
    const ok = validarCedulaBase(d);
    return {
      valido: ok,
      tipo: "Cédula",
      mensaje: ok ? "Válido. Cédula de identidad." : "Dígito verificador incorrecto.",
      provincia,
      esPersonaNatural: true,
    };
  }

  // 11 o 12 dígitos
  return {
    valido: false, tipo: "-",
    mensaje: "Longitud inválida: cédula = 10 dígitos, RUC = 13 dígitos.",
    provincia,
  };
}

export function novenoDigitoRuc(ruc: string): number | null {
  const clean = (ruc || "").trim();
  if (!/^\d{13}$/.test(clean)) return null;
  return Number(clean[8]);
}
