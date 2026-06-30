(function initPayrollAt2026(root) {
  "use strict";

  var CONSTANTS = {
    year: 2026,
    monthlyContributionBaseMax: 6930,
    specialContributionBaseMaxAnnual: 13860,
    employeeBaseRateOngoing: 0.1537,
    employeeBaseRateSpecial: 0.1412,
    employeeFullRateOngoing: 0.1832,
    employeeFullRateSpecial: 0.1707,
    alvBands: [
      { upTo: 2249, ongoingRate: 0.1537, specialRate: 0.1412 },
      { upTo: 2449, ongoingRate: 0.1637, specialRate: 0.1512 },
      { upTo: 2629, ongoingRate: 0.1737, specialRate: 0.1612 },
      { upTo: Infinity, ongoingRate: 0.1832, specialRate: 0.1707 }
    ],
    employeeCredit: 496,
    employeeExpenseAllowance: 132,
    taxBands: [
      { upTo: 13539, rate: 0 },
      { upTo: 21992, rate: 0.20 },
      { upTo: 36458, rate: 0.30 },
      { upTo: 70365, rate: 0.40 },
      { upTo: 104859, rate: 0.48 },
      { upTo: 1000000, rate: 0.50 },
      { upTo: Infinity, rate: 0.55 }
    ],
    specialTaxBands: [
      { upTo: 620, rate: 0 },
      { upTo: 25000, rate: 0.06 },
      { upTo: 50000, rate: 0.27 },
      { upTo: 83333, rate: 0.3575 }
    ],
    specialReducedTaxLimit: 83333,
    specialTaxFreeLimit: 2100
  };

  function calculate(detection, settings) {
    var amount = Number(detection && detection.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid gross amount");
    }

    var warnings = unsupportedSettingsWarnings(settings);
    var period = detection.period === "annual" ? "annual" : "monthly";
    var grossOngoingExact = period === "annual" ? amount / 14 : amount;
    var grossOngoing = roundMoney(grossOngoingExact);
    var grossBonus13 = grossOngoing;
    var grossBonus14 = grossOngoing;
    var grossAnnual = period === "annual" ? roundMoney(amount) : roundMoney(grossOngoing * 14);

    var svOngoing = calculateOngoingSocialInsurance(grossOngoing);
    var specialSv = calculateSpecialSocialInsurance(grossOngoing, grossBonus13, grossBonus14);

    var annualTaxable = Math.max(0, roundMoney((grossOngoingExact - svOngoing) * 12 - CONSTANTS.employeeExpenseAllowance - annualFreibetrag(settings)));
    var annualTaxCredits = CONSTANTS.employeeCredit + familyBonus(settings);
    var annualOngoingTax = Math.max(0, roundMoney(incomeTax(annualTaxable) - annualTaxCredits));
    var taxOngoing = roundMoney(annualOngoingTax / 12);

    var taxableBonus13 = roundMoney(grossBonus13 - specialSv.bonus13);
    var taxableBonus14 = roundMoney(grossBonus14 - specialSv.bonus14);
    var specialTaxableTotal = roundMoney(taxableBonus13 + taxableBonus14);
    var taxBonus13 = 0;
    var taxBonus14 = 0;
    if (specialTaxableTotal > CONSTANTS.specialTaxFreeLimit) {
      taxBonus13 = roundMoney(specialTaxIncrement(0, taxableBonus13, annualTaxable, annualTaxCredits));
      taxBonus14 = roundMoney(specialTaxIncrement(taxableBonus13, taxableBonus14, annualTaxable, annualTaxCredits));
    }

    var socialInsuranceAnnual = roundMoney(svOngoing * 12 + specialSv.bonus13 + specialSv.bonus14);
    var taxAnnual = roundMoney(taxOngoing * 12 + taxBonus13 + taxBonus14);

    return {
      source: "formula-at-2026",
      stand: "Formel 2026",
      assumptions: [
        "Arbeitnehmer/in oder Angestellte/r",
        "14 gleich hohe Bruttobezüge",
        "Werbungskostenpauschale 132 EUR",
        "Verkehrsabsetzbetrag 496 EUR",
        "SV- und Lohnsteuertarif 2026"
      ],
      warnings: warnings,
      gross: {
        ongoing: grossOngoing,
        bonus13: grossBonus13,
        bonus14: grossBonus14,
        annual: grossAnnual
      },
      socialInsurance: {
        ongoing: svOngoing,
        bonus13: specialSv.bonus13,
        bonus14: specialSv.bonus14,
        annual: socialInsuranceAnnual
      },
      tax: {
        ongoing: taxOngoing,
        bonus13: taxBonus13,
        bonus14: taxBonus14,
        annual: taxAnnual
      },
      net: {
        ongoing: roundMoney(grossOngoing - svOngoing - taxOngoing),
        bonus13: roundMoney(grossBonus13 - specialSv.bonus13 - taxBonus13),
        bonus14: roundMoney(grossBonus14 - specialSv.bonus14 - taxBonus14),
        annual: roundMoney(grossAnnual - socialInsuranceAnnual - taxAnnual)
      }
    };
  }

  function calculateOngoingSocialInsurance(grossOngoing) {
    var base = Math.min(roundMoney(grossOngoing), CONSTANTS.monthlyContributionBaseMax);
    return roundMoney(base * socialInsuranceRate(grossOngoing, false));
  }

  function calculateSpecialSocialInsurance(grossOngoing, bonus13, bonus14) {
    var remaining = CONSTANTS.specialContributionBaseMaxAnnual;
    var rate = socialInsuranceRate(grossOngoing, true);
    var base13 = Math.min(roundMoney(bonus13), remaining);
    remaining = roundMoney(remaining - base13);
    var base14 = Math.min(roundMoney(bonus14), Math.max(0, remaining));
    return {
      bonus13: roundMoney(base13 * rate),
      bonus14: roundMoney(base14 * rate)
    };
  }

  function socialInsuranceRate(grossOngoing, special) {
    var gross = roundMoney(grossOngoing);
    for (var index = 0; index < CONSTANTS.alvBands.length; index += 1) {
      var band = CONSTANTS.alvBands[index];
      if (gross <= band.upTo) {
        return special ? band.specialRate : band.ongoingRate;
      }
    }
    return special ? CONSTANTS.employeeFullRateSpecial : CONSTANTS.employeeFullRateOngoing;
  }

  function incomeTax(taxableAnnualIncome) {
    return progressiveTax(taxableAnnualIncome, CONSTANTS.taxBands);
  }

  function specialTaxIncrement(alreadyTaxedBase, nextBase, annualTaxable, annualTaxCredits) {
    var limit = CONSTANTS.specialReducedTaxLimit;
    var reducedBefore = Math.min(alreadyTaxedBase, limit);
    var reducedAfter = Math.min(alreadyTaxedBase + nextBase, limit);
    var reducedTax = progressiveTax(reducedAfter, CONSTANTS.specialTaxBands) - progressiveTax(reducedBefore, CONSTANTS.specialTaxBands);
    var overflowBefore = Math.max(0, alreadyTaxedBase - limit);
    var overflowAfter = Math.max(0, alreadyTaxedBase + nextBase - limit);
    var overflowInThisPayment = roundMoney(overflowAfter - overflowBefore);
    return roundMoney(reducedTax + currentMonthTariffIncrement(annualTaxable, overflowInThisPayment, annualTaxCredits));
  }

  function currentMonthTariffIncrement(annualTaxable, extraTaxableInMonth, annualTaxCredits) {
    if (!extraTaxableInMonth) {
      return 0;
    }
    var base = Math.max(0, Number(annualTaxable) || 0);
    var credits = Math.max(0, Number(annualTaxCredits) || 0);
    var before = Math.max(0, incomeTax(base) - credits);
    var after = Math.max(0, incomeTax(roundMoney(base + extraTaxableInMonth * 12)) - credits);
    return roundMoney((after - before) / 12);
  }

  function progressiveTax(amount, bands) {
    var value = Math.max(0, Number(amount) || 0);
    var tax = 0;
    var lower = 0;
    for (var index = 0; index < bands.length; index += 1) {
      var band = bands[index];
      var upper = Math.min(value, band.upTo);
      if (upper > lower) {
        tax += (upper - lower) * band.rate;
      }
      if (value <= band.upTo) {
        break;
      }
      lower = band.upTo;
    }
    return roundMoney(tax);
  }

  function annualFreibetrag(settings) {
    if (!settings || settings.freibetrag === undefined) {
      return 0;
    }
    return parseSettingsAmount(settings.freibetrag);
  }

  function familyBonus(settings) {
    if (!settings || String(settings.familienBonus || "0") !== "1") {
      return 0;
    }
    var children17 = Math.max(0, Number(settings.kinder17) || 0);
    var children18 = Math.max(0, Number(settings.kinder18) || 0);
    return roundMoney(children17 * 166.68 * 12 + children18 * 58.34 * 12);
  }

  function unsupportedSettingsWarnings(settings) {
    var warnings = [];
    var relation = settings && settings.arbeitsverhaeltnis !== undefined ? String(settings.arbeitsverhaeltnis) : "1";
    if (relation !== "1") {
      warnings.push("Offline-v2 ist derzeit auf Arbeiter/in oder Angestellte/r kalibriert.");
    }
    if (settings && parseSettingsAmount(settings.sachbezug) > 0) {
      warnings.push("Sachbezug wird in Offline-v2 noch nicht in der SV-Bemessung abgebildet.");
    }
    if (settings && String(settings.sachbezugKFZ || "0") !== "0") {
      warnings.push("KFZ-Sachbezug wird in Offline-v2 noch nicht abgebildet.");
    }
    if (settings && parseSettingsAmount(settings.wegstrecke) > 0) {
      warnings.push("Pendlerpauschale/Pendlereuro wird in Offline-v2 noch nicht abgebildet.");
    }
    if (settings && String(settings.alleinverdienerabsetzbetrag || "0") !== "0") {
      warnings.push("Alleinverdiener-/Alleinerzieherabsetzbetrag wird in Offline-v2 noch nicht abgebildet.");
    }
    return warnings;
  }

  function parseSettingsAmount(value) {
    var normalized = String(value || "0")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");
    var parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  var api = {
    CONSTANTS: CONSTANTS,
    calculate: calculate,
    incomeTax: incomeTax,
    socialInsuranceRate: socialInsuranceRate,
    calculateOngoingSocialInsurance: calculateOngoingSocialInsurance,
    calculateSpecialSocialInsurance: calculateSpecialSocialInsurance,
    specialTaxIncrement: specialTaxIncrement,
    roundMoney: roundMoney
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ATPayroll2026 = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
