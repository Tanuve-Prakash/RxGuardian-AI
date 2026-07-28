import { fetchOpenFDADrugLabel } from './openfda';

export interface SafetyAlert {
  id: string;
  type: 'interaction' | 'duplicate' | 'lasa' | 'allergy' | 'contraindication' | 'high_risk' | 'dosage_warning';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affected_medicines: string[];
}

export interface PatientContext {
  allergies?: string | null;
  renal_impairment?: boolean | number;
  hepatic_impairment?: boolean | number;
  is_pregnant?: boolean | number;
  current_medications?: Array<{ name: string; rxcui?: string | null; started_at?: string | null }> | null;
  previous_reactions?: string | null;
  patient_id?: string | null;
}

export interface SafetyCheckResult {
  alerts: SafetyAlert[];
  assessment_summary: {
    drug_interactions_assessed: boolean;
    patient_context_assessed: boolean;
    missing_context_notes: string[];
  };
}

// Confusable / LASA (Look-Alike Sound-Alike) drug pairs for clinical safety checks
const LASA_PAIRS: [string, string][] = [
  ['celexa', 'zyprexa'],
  ['hydred', 'hydrea'],
  ['chlorpromazine', 'chlorpropamide'],
  ['clonazepam', 'clonidine'],
  ['lamictal', 'lamisil'],
  ['amiodarone', 'amlodipine'],
  ['metformin', 'metoprolol'],
  ['prednisone', 'prednisolone'],
  ['vinblastine', 'vincristine'],
  ['advair', 'advicor']
];

export async function runSafetyChecks(
  medicines: Array<{
    name: string;
    rxcui?: string | null;
    strength?: string | null;
    frequency?: string | null;
    confidence?: number;
    consensus_agreement?: boolean;
    needs_review?: boolean;
    raw_text?: string;
  }>,
  patientContext?: PatientContext
): Promise<SafetyCheckResult> {
  const alerts: SafetyAlert[] = [];
  const missingNotes: string[] = [];

  if (!medicines || medicines.length === 0) {
    return {
      alerts: [],
      assessment_summary: {
        drug_interactions_assessed: false,
        patient_context_assessed: false,
        missing_context_notes: ['No medicines provided for safety analysis.']
      }
    };
  }

  // 1. Fetch OpenFDA label safety data in parallel
  const openfdaResults = await Promise.all(
    medicines.map(m => fetchOpenFDADrugLabel(m.name))
  );

  // 2. Check Drug-Drug Interactions, Legibility Risks & OpenFDA Warnings
  for (let i = 0; i < medicines.length; i++) {
    const medA = medicines[i];
    const labelA = openfdaResults[i];

    // SIGNAL A: Handwriting / Legibility Risk
    if (
      medA.consensus_agreement === false ||
      (typeof medA.confidence === 'number' && medA.confidence < 80) ||
      medA.needs_review === true
    ) {
      alerts.push({
        id: `alert-legibility-${i}-${Date.now()}`,
        type: 'high_risk',
        severity: typeof medA.confidence === 'number' && medA.confidence < 65 ? 'high' : 'medium',
        title: `Low Handwriting Legibility: ${medA.name}`,
        description: `Handwriting legibility uncertainty detected for "${medA.name}" (Confidence: ${
          typeof medA.confidence === 'number' ? medA.confidence + '%' : 'unconfirmed'
        }${medA.consensus_agreement === false ? ', Consensus agreement failed' : ''}). Low legibility — verify before dispensing.`,
        affected_medicines: [medA.name]
      });
    }

    if (labelA.found && labelA.drug_interactions) {
      // Check if other medicines in list are mentioned in Med A's OpenFDA interaction text
      for (let j = 0; j < medicines.length; j++) {
        if (i === j) continue;
        const medB = medicines[j];
        const medBNameLower = medB.name.toLowerCase();

        if (labelA.drug_interactions.toLowerCase().includes(medBNameLower)) {
          alerts.push({
            id: `alert-int-${i}-${j}-${Date.now()}`,
            type: 'interaction',
            severity: 'high',
            title: `Potential Interaction: ${medA.name} & ${medB.name}`,
            description: `OpenFDA clinical label notes potential drug interaction between ${medA.name} and ${medB.name}: "${labelA.drug_interactions.substring(0, 200)}..."`,
            affected_medicines: [medA.name, medB.name]
          });
        }
      }
    }

    if (labelA.found && labelA.warnings) {
      alerts.push({
        id: `alert-warn-${i}-${Date.now()}`,
        type: 'high_risk',
        severity: 'medium',
        title: `Clinical Warning: ${medA.name}`,
        description: `OpenFDA Boxed/Cautions Warning: "${labelA.warnings.substring(0, 250)}..."`,
        affected_medicines: [medA.name]
      });
    }

    // Missing dosage/strength alert
    if (!medA.strength || !medA.frequency) {
      alerts.push({
        id: `alert-dosage-${i}-${Date.now()}`,
        type: 'dosage_warning',
        severity: 'medium',
        title: `Incomplete Prescription Detail: ${medA.name}`,
        description: `Prescription detail for ${medA.name} lacks ${!medA.strength ? 'strength' : ''}${!medA.strength && !medA.frequency ? ' and ' : ''}${!medA.frequency ? 'frequency' : ''}. Pharmacist verification required.`,
        affected_medicines: [medA.name]
      });
    }
  }

  // 3. Check Duplicate Therapies & LASA (Look-Alike Sound-Alike) Names
  for (let i = 0; i < medicines.length; i++) {
    for (let j = i + 1; j < medicines.length; j++) {
      const nameA = medicines[i].name.toLowerCase().trim();
      const nameB = medicines[j].name.toLowerCase().trim();

      // Exact or near-duplicate check
      if (nameA === nameB || (nameA.length > 4 && nameB.length > 4 && (nameA.includes(nameB) || nameB.includes(nameA)))) {
        alerts.push({
          id: `alert-dup-${i}-${j}-${Date.now()}`,
          type: 'duplicate',
          severity: 'high',
          title: `Duplicate Therapy Detected: ${medicines[i].name}`,
          description: `Multiple line items identified for ${medicines[i].name} and ${medicines[j].name}. Risk of accidental double dosing.`,
          affected_medicines: [medicines[i].name, medicines[j].name]
        });
      }

      // LASA Check
      const isLasa = LASA_PAIRS.some(pair =>
        (nameA.includes(pair[0]) && nameB.includes(pair[1])) ||
        (nameA.includes(pair[1]) && nameB.includes(pair[0]))
      );

      if (isLasa) {
        alerts.push({
          id: `alert-lasa-${i}-${j}-${Date.now()}`,
          type: 'lasa',
          severity: 'high',
          title: `Confusable / LASA Drug Name Flag: ${medicines[i].name} / ${medicines[j].name}`,
          description: `${medicines[i].name} and ${medicines[j].name} are known Look-Alike Sound-Alike (LASA) medicines. Verify prescription handwriting and intention carefully.`,
          affected_medicines: [medicines[i].name, medicines[j].name]
        });
      }
    }
  }

  // 4. Patient Context Assessment (Allergies, Pregnancy, Renal, Hepatic)
  let patientContextAssessed = false;

  if (patientContext) {
    // Allergies Check
    if (patientContext.allergies && patientContext.allergies.trim().length > 0) {
      patientContextAssessed = true;
      const allergyLower = patientContext.allergies.toLowerCase();

      for (let i = 0; i < medicines.length; i++) {
        const medName = medicines[i].name.toLowerCase();
        if (allergyLower.includes(medName) || medName.includes(allergyLower)) {
          alerts.push({
            id: `alert-allergy-${i}-${Date.now()}`,
            type: 'allergy',
            severity: 'high',
            title: `Allergy Conflict Detected: ${medicines[i].name}`,
            description: `Patient has a documented allergy ("${patientContext.allergies}") matching prescribed medicine ${medicines[i].name}.`,
            affected_medicines: [medicines[i].name]
          });
        }
      }
    } else {
      missingNotes.push('Patient allergy history not provided — allergy conflict not assessed.');
    }

    // Pregnancy Check
    if (Boolean(patientContext.is_pregnant)) {
      patientContextAssessed = true;
      for (let i = 0; i < medicines.length; i++) {
        const label = openfdaResults[i];
        if (label.found && label.pregnancy_or_breastfeeding) {
          alerts.push({
            id: `alert-preg-${i}-${Date.now()}`,
            type: 'contraindication',
            severity: 'high',
            title: `Pregnancy Caution: ${medicines[i].name}`,
            description: `OpenFDA Pregnancy Warning for ${medicines[i].name}: "${label.pregnancy_or_breastfeeding.substring(0, 200)}..."`,
            affected_medicines: [medicines[i].name]
          });
        }
      }
    } else {
      missingNotes.push('Pregnancy status not indicated.');
    }

    // Renal / Hepatic Impairment Check
    if (Boolean(patientContext.renal_impairment) || Boolean(patientContext.hepatic_impairment)) {
      patientContextAssessed = true;
      for (let i = 0; i < medicines.length; i++) {
        const label = openfdaResults[i];
        if (label.found && label.contraindications) {
          alerts.push({
            id: `alert-impair-${i}-${Date.now()}`,
            type: 'contraindication',
            severity: 'medium',
            title: `Organ Impairment Precaution: ${medicines[i].name}`,
            description: `OpenFDA contraindication profile for ${medicines[i].name} notes: "${label.contraindications.substring(0, 200)}..."`,
            affected_medicines: [medicines[i].name]
          });
        }
      }
    }

    // SIGNAL B: Patient History Interaction Risk (Passport active medications & adverse history)
    if (patientContext.current_medications && Array.isArray(patientContext.current_medications) && patientContext.current_medications.length > 0) {
      patientContextAssessed = true;
      const NSAID_KEYWORDS = [
        'ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve', 'naprosyn',
        'aspirin', 'bayer', 'ketorolac', 'toradol', 'celecoxib', 'celebrex',
        'diclofenac', 'voltaren', 'meloxicam', 'mobic', 'indomethacin', 'indocin', 'piroxicam'
      ];

      for (let i = 0; i < medicines.length; i++) {
        const medA = medicines[i];
        const labelA = openfdaResults[i];
        const medANameLower = medA.name.toLowerCase().trim();

        for (const currMed of patientContext.current_medications) {
          if (!currMed.name) continue;
          const currMedLower = currMed.name.toLowerCase().trim();

          // Check 1: OpenFDA label interaction text mentions active passport medication name
          const mentionsInLabel = Boolean(
            labelA.found &&
            labelA.drug_interactions &&
            labelA.drug_interactions.toLowerCase().includes(currMedLower)
          );

          // Check 2: Known clinical risk pair (e.g. Warfarin/Coumadin + NSAID/Aspirin)
          const isWarfarinNsaid = (
            (currMedLower.includes('warfarin') || currMedLower.includes('coumadin')) &&
            NSAID_KEYWORDS.some(k => medANameLower.includes(k))
          ) || (
            NSAID_KEYWORDS.some(k => currMedLower.includes(k)) &&
            (medANameLower.includes('warfarin') || medANameLower.includes('coumadin'))
          );

          if (mentionsInLabel || isWarfarinNsaid) {
            let desc = `Patient is actively taking ${currMed.name} (from linked RxGuardian Passport). Co-prescribing ${medA.name} carries a high risk interaction.`;
            if (isWarfarinNsaid) {
              desc = `Critical Patient History Risk: Patient is actively taking ${currMed.name} (RxGuardian Passport). Prescribing an NSAID or Aspirin (${medA.name}) creates a severe risk of gastrointestinal bleeding, ulceration, and hemorrhage.`;
            } else if (labelA.drug_interactions) {
              desc = `OpenFDA Interaction Warning: Co-administering newly prescribed ${medA.name} with active passport medication ${currMed.name}: "${labelA.drug_interactions.substring(0, 200)}..."`;
            }

            alerts.push({
              id: `alert-passport-int-${i}-${currMed.name.replace(/\s+/g, '_')}-${Date.now()}`,
              type: 'interaction',
              severity: 'high',
              title: `Patient History Interaction Risk: ${medA.name} & ${currMed.name}`,
              description: desc,
              affected_medicines: [medA.name, currMed.name]
            });
          }
        }
      }
    }

    // Previous Adverse Reactions Check
    if (patientContext.previous_reactions && patientContext.previous_reactions.trim().length > 0) {
      patientContextAssessed = true;
      const rxLower = patientContext.previous_reactions.toLowerCase();
      for (let i = 0; i < medicines.length; i++) {
        const medName = medicines[i].name.toLowerCase();
        if (rxLower.includes(medName) || medName.includes(rxLower)) {
          alerts.push({
            id: `alert-prev-react-${i}-${Date.now()}`,
            type: 'high_risk',
            severity: 'high',
            title: `Prior Adverse Reaction Warning: ${medicines[i].name}`,
            description: `Patient's Passport records prior adverse reactions matching ${medicines[i].name}: "${patientContext.previous_reactions}".`,
            affected_medicines: [medicines[i].name]
          });
        }
      }
    }
  } else {
    missingNotes.push('Not assessed — no patient context provided.');
  }

  return {
    alerts,
    assessment_summary: {
      drug_interactions_assessed: true,
      patient_context_assessed: patientContextAssessed,
      missing_context_notes: missingNotes
    }
  };
}
