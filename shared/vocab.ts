export const CAUSES = ['mordisco', 'estrés', 'comida', 'cepillado', 'dentífrico', 'hormonal', 'desconocida'] as const;

export const TREATMENTS = ['ninguno', 'enjuague', 'gel', 'corticoide'] as const;

export const PAIN_LABELS: Record<number, string> = {
  1: 'Apenas',
  2: 'Leve',
  3: 'Molesta',
  4: 'Mucho',
  5: 'Insoportable',
};
