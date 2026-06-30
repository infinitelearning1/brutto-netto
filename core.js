(function initCore(root) {
  "use strict";

  var DEFAULT_SETTINGS = {
    arbeitsverhaeltnis: "1",
    bundesland: "0",
    alleinverdienerabsetzbetrag: "0",
    familienBonus: "0",
    kinder17: "0",
    kinder18: "0",
    sachbezug: "0,00",
    sachbezugKFZ: "0",
    freibetrag: "0,00",
    wegstrecke: "0,00",
    verkehrsmittel: "1",
    pendeltage: "3",
    mehrKinder: "0",
    calculationMode: "formula-at-2026",
    annualThreshold: 20000,
    monthlyThreshold: 15000
  };

  var BUNDESLAND_OPTIONS = [
    ["0", "Wien"],
    ["1", "Niederösterreich"],
    ["2", "Oberösterreich"],
    ["3", "Burgenland"],
    ["4", "Salzburg"],
    ["5", "Steiermark"],
    ["6", "Kärnten"],
    ["7", "Tirol"],
    ["8", "Vorarlberg"]
  ];

  var WORK_RELATION_OPTIONS = [
    ["1", "Arbeiter/in oder Angestellte/r"],
    ["4", "Lehrling"],
    ["3", "Pensionist/in"]
  ];

  function mergeSettings(settings) {
    var merged = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function copyDefault(key) {
      merged[key] = DEFAULT_SETTINGS[key];
    });
    if (settings) {
      Object.keys(settings).forEach(function copySetting(key) {
        if (settings[key] !== undefined && settings[key] !== null && settings[key] !== "") {
          merged[key] = settings[key];
        }
      });
    }
    merged.annualThreshold = Number(merged.annualThreshold) || DEFAULT_SETTINGS.annualThreshold;
    merged.monthlyThreshold = Number(merged.monthlyThreshold) || DEFAULT_SETTINGS.monthlyThreshold;
    return merged;
  }

  function normalizeWhitespace(value) {
    return String(value || "")
      .replace(/[\u00a0\u202f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseLocaleNumber(rawValue) {
    var raw = String(rawValue || "").trim();
    var value = raw
      .replace(/[\u00a0\u202f]/g, " ")
      .replace(/['\s]/g, "")
      .replace(/[^\d,.\-]/g, "");
    value = value.replace(/[,.]-+$/, "");

    if (!value || !/\d/.test(value) || value.indexOf("-") === 0) {
      return null;
    }

    value = value.replace(/^-+/, "");

    var dotCount = countChar(value, ".");
    var commaCount = countChar(value, ",");
    var normalized;

    if (dotCount > 0 && commaCount > 0) {
      var lastDot = value.lastIndexOf(".");
      var lastComma = value.lastIndexOf(",");
      var decimalSep = lastDot > lastComma ? "." : ",";
      var groupSep = decimalSep === "." ? "," : ".";
      normalized = value.split(groupSep).join("");
      normalized = replaceLast(normalized, decimalSep, ".");
    } else if (commaCount > 0) {
      normalized = normalizeSingleSeparatorNumber(value, ",");
    } else if (dotCount > 0) {
      normalized = normalizeSingleSeparatorNumber(value, ".");
    } else {
      normalized = value;
    }

    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      return null;
    }

    var parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return parsed;
  }

  function countChar(value, char) {
    return (String(value).match(new RegExp("\\" + char, "g")) || []).length;
  }

  function replaceLast(value, search, replacement) {
    var index = value.lastIndexOf(search);
    if (index < 0) {
      return value;
    }
    return value.slice(0, index) + replacement + value.slice(index + search.length);
  }

  function normalizeSingleSeparatorNumber(value, separator) {
    var parts = value.split(separator);
    if (parts.length === 1) {
      return value;
    }

    var last = parts[parts.length - 1];
    if (last.length === 0) {
      return parts.slice(0, -1).join("");
    }

    if (parts.length > 2) {
      var allMiddleLookGrouped = parts.slice(1).every(function isGrouped(part) {
        return part.length === 3;
      });
      if (allMiddleLookGrouped) {
        return parts.join("");
      }
    }

    if (last.length === 3 && parts[0].length <= 3) {
      return parts.join("");
    }

    if (last.length <= 2) {
      return parts.slice(0, -1).join("") + "." + last;
    }

    return parts.join("");
  }

  function formatLocaleAmount(amount) {
    var fixed = Number(amount).toFixed(2);
    var parts = fixed.split(".");
    var euros = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return euros + "," + parts[1];
  }

  function formatEuro(amount) {
    if (!Number.isFinite(Number(amount))) {
      return "";
    }
    return formatLocaleAmount(Number(amount)) + " EUR";
  }

  function hasCurrencyCue(text) {
    return /(\beur\b|\beuro\b|\u20ac)/i.test(normalizeWhitespace(text));
  }

  function hasSalaryWord(text) {
    var haystack = normalizeWhitespace(text).toLowerCase();
    return /(brutto|netto|gehalt|lohn|bezug|salary|gross|verdien|entgelt|verg(?:ue|\u00fc)tung|entlohnung|bezahlung|kollektivvertrag|\bkv\b|mindest(?:gehalt|entgelt)|all-?in|compensation|remuneration)/i.test(haystack);
  }

  function hasAnnualCue(text) {
    var haystack = normalizeWhitespace(text).toLowerCase();
    return /(jahres|bruttojahres|j(?:ae|\u00e4)hr(?:lich|es|ig)?|p\.?\s*a\.?|per annum|annual(?:ly)?|yearly|per year|pro jahr|\/\s*jahr|annum)/i.test(haystack);
  }

  function hasMonthlyCue(text) {
    var haystack = normalizeWhitespace(text).toLowerCase();
    return /(monat|monatl|bruttomonats|monatsbrutto|p\.?\s*m\.?|per month|monthly|pro monat|\/\s*(?:mo|monat|m)\b|\b\d{1,2}\s*x\b|\bx\s*1[234]\b|1[234]\s*(?:mal|geh(?:a|ä)lter|bez(?:u|ü)ge))/i.test(haystack);
  }

  function hasSalaryCue(text) {
    return hasCurrencyCue(text) || hasSalaryWord(text) || hasAnnualCue(text) || hasMonthlyCue(text);
  }

  function inferPeriod(amount, selectionText, contextText, settings) {
    var merged = mergeSettings(settings);
    var selection = normalizeWhitespace(selectionText).toLowerCase();
    var context = normalizeWhitespace(contextText).toLowerCase();
    var combined = (selection + " " + context).trim();

    var annualInSelection = hasAnnualCue(selection);
    var monthlyInSelection = hasMonthlyCue(selection);
    var annualInContext = hasAnnualCue(combined);
    var monthlyInContext = hasMonthlyCue(combined);

    if (annualInSelection && !monthlyInSelection && amount >= merged.annualThreshold) {
      return { period: "annual", reason: "selection-keyword" };
    }
    if (monthlyInSelection && !annualInSelection) {
      return { period: "monthly", reason: "selection-keyword" };
    }
    if (annualInContext && !monthlyInContext && amount >= merged.annualThreshold) {
      return { period: "annual", reason: "context-keyword" };
    }
    if (monthlyInContext && !annualInContext) {
      return { period: "monthly", reason: "context-keyword" };
    }
    if (annualInContext && monthlyInContext) {
      return amount >= merged.annualThreshold
        ? { period: "annual", reason: "mixed-context-amount-threshold" }
        : { period: "monthly", reason: "mixed-context-amount-threshold" };
    }
    if (amount >= merged.annualThreshold) {
      return { period: "annual", reason: "amount-threshold" };
    }
    if (amount <= merged.monthlyThreshold) {
      return { period: "monthly", reason: "amount-threshold" };
    }
    return { period: "annual", reason: "ambiguous-annual-default" };
  }

  function extractSalaryCandidates(selectionText, contextText, settings) {
    var selection = normalizeWhitespace(selectionText);
    var context = normalizeWhitespace(contextText);
    if (!selection && !context) {
      return [];
    }

    var candidates = [];
    candidates = candidates.concat(extractCandidatesFromText(selection, "selection", selection, context, settings));
    if (context && context !== selection) {
      candidates = candidates.concat(extractCandidatesFromText(context, "context", selection, context, settings));
    }
    return dedupeCandidates(candidates);
  }

  function extractCandidatesFromText(text, source, selection, context, settings) {
    if (!text) {
      return [];
    }

    var pattern = /(?:\b(?:EUR|Euro)\b|\u20ac)?\s*([0-9](?:[0-9 .,'\u00a0\u202f]*[0-9])?(?:(?:[,.][0-9]{1,2})|(?:[,.]-{1,2}))?)(?:\s*(k|K|tsd\.?|tausend))?(?:\s*(?:\b(?:EUR|Euro)\b|\u20ac))?/giu;
    var candidates = [];
    var match;
    while ((match = pattern.exec(text)) !== null) {
      var full = normalizeWhitespace(match[0]);
      var rawNumber = match[1];
      var suffix = match[2] || "";
      if (looksLikeSeparatedListNumber(rawNumber)) {
        continue;
      }
      var value = parseLocaleNumber(rawNumber);
      if (value === null) {
        continue;
      }
      if (/^(k|tsd\.?|tausend)$/i.test(suffix)) {
        value *= 1000;
      }
      if (value < 1000 || value > 1000000) {
        continue;
      }
      var localContext = getLocalContext(text, match.index, full.length);
      var tightContext = getTightContext(text, match.index, full.length);
      if (source === "selection" && context) {
        var contextIndex = context.indexOf(full);
        if (contextIndex >= 0) {
          localContext += " " + getLocalContext(context, contextIndex, full.length);
          tightContext += " " + getTightContext(context, contextIndex, full.length);
        }
      }
      var salaryCue = hasSalaryCue(localContext) || hasSalaryCue(selection + " " + context);
      var strongLocalCue = hasCurrencyCue(tightContext) || hasSalaryWord(tightContext) || hasAnnualCue(tightContext) || hasMonthlyCue(tightContext);
      if (looksLikeIdentifierNumber(full, tightContext) ||
          looksLikeAddressOrAssetNumber(value, full, tightContext) ||
          looksLikeHeadcountNumber(full, tightContext)) {
        continue;
      }
      if (value >= 1900 && value <= 2099 && !strongLocalCue) {
        continue;
      }
      if (source === "context" && !strongLocalCue && !hasSalaryCue(localContext)) {
        continue;
      }
      if (value < 1200 && !strongLocalCue) {
        continue;
      }
      var period = inferPeriod(value, source === "selection" ? selection : "", localContext + " " + context, settings);
      if (period.period === "annual" && value < mergeSettings(settings).annualThreshold && !hasCurrencyCue(full) && !hasCurrencyCue(tightContext)) {
        continue;
      }
      var score = scoreCandidate(value, source, full, tightContext, localContext, salaryCue, strongLocalCue, settings);
      if (score < 0) {
        continue;
      }
      candidates.push({
        amount: roundMoney(value),
        raw: full,
        period: period.period,
        reason: period.reason,
        index: match.index,
        source: source,
        score: score
      });
    }
    return candidates;
  }

  function getLocalContext(text, index, length) {
    var value = String(text || "");
    var start = Math.max(0, index - 100);
    var end = Math.min(value.length, index + length + 130);
    return normalizeWhitespace(value.slice(start, end));
  }

  function getTightContext(text, index, length) {
    var value = String(text || "");
    var start = Math.max(0, index - 35);
    var end = Math.min(value.length, index + length + 70);
    return normalizeWhitespace(value.slice(start, end));
  }

  function scoreCandidate(value, source, full, tightContext, localContext, salaryCue, strongLocalCue, settings) {
    var merged = mergeSettings(settings);
    var score = source === "selection" ? 30 : 5;
    var tight = normalizeWhitespace(tightContext);
    var local = normalizeWhitespace(localContext);

    if (hasCurrencyCue(full) || hasCurrencyCue(tight)) {
      score += 45;
    }
    if (hasSalaryWord(tight)) {
      score += 45;
    } else if (hasSalaryWord(local)) {
      score += 20;
    }
    if (hasAnnualCue(tight) || hasMonthlyCue(tight)) {
      score += 30;
    } else if (hasAnnualCue(local) || hasMonthlyCue(local)) {
      score += 12;
    }
    if (/\b(ab|mindestens|minimum|from|von|bis|range|spannen?|zwischen)\b/i.test(tight)) {
      score += 8;
    }
    if (!strongLocalCue && salaryCue) {
      score += 6;
    }
    if (value >= merged.annualThreshold || (value >= 1200 && value <= merged.monthlyThreshold)) {
      score += 10;
    }
    if (/\b(plz|postleitzahl|adresse|standort|location|ref(?:erenz)?\.?|kennzahl|job[-\s]?id|telefon|phone)\b/i.test(tight)) {
      score -= 70;
    }
    if (/\b(stunden|wochenstunden|hours|std\.?)\b/i.test(tight) && !hasCurrencyCue(tight) && !hasSalaryWord(tight)) {
      score -= 50;
    }
    if (value < 1500 && !strongLocalCue) {
      score -= 25;
    }
    return score;
  }

  function looksLikeIdentifierNumber(full, tightContext) {
    if (hasCurrencyCue(full)) {
      return false;
    }
    var fullText = normalizeWhitespace(full).toLowerCase();
    var tight = normalizeWhitespace(tightContext).toLowerCase();
    var index = tight.indexOf(fullText);
    var before = index >= 0 ? tight.slice(0, index) : tight;
    return /\b(ref(?:erenz)?\.?|referenznummer|kennzahl|job[-\s]?id|id|nummer)\b[\s:#.-]*$/i.test(before) ||
      /\b(ref(?:erenz)?\.?|referenznummer|kennzahl|job[-\s]?id)\b/i.test(before.slice(-45));
  }

  function looksLikeSeparatedListNumber(rawNumber) {
    return /[,.]\s+\d{2,}/.test(String(rawNumber || ""));
  }

  function looksLikeAddressOrAssetNumber(value, full, tightContext) {
    if (hasCurrencyCue(full)) {
      return false;
    }
    var tight = normalizeWhitespace(tightContext).toLowerCase();
    if (value >= 1000 && value <= 9999 && /\b(plz|postleitzahl|post\s*code|postcode|adresse|address|standort|location|wien|vienna|gasse|strasse|stra\u00dfe|platz)\b/i.test(tight)) {
      return true;
    }
    return /(https?:|www\.|\/jobs\b|\/job\b|logo|upload|asset|companylogourl|company[-_]?id|arbeitgeber[-_]?id|employer[-_]?id|%[0-9a-f]{2})/i.test(tight);
  }

  function looksLikeHeadcountNumber(full, tightContext) {
    if (hasCurrencyCue(full)) {
      return false;
    }
    var fullText = normalizeWhitespace(full).toLowerCase();
    var tight = normalizeWhitespace(tightContext).toLowerCase();
    var index = tight.indexOf(fullText);
    var after = index >= 0 ? tight.slice(index + fullText.length, index + fullText.length + 60) : tight;
    var before = index >= 0 ? tight.slice(Math.max(0, index - 40), index) : "";
    return /\b(mitarbeiter|mitarbeiterinnen|mitarbeiter:innen|besch(?:ae|\u00e4)ftigte|angestellte|employees|people|teammitglieder)\b/i.test(after) ||
      /\b(durchschnittlich|rund|ca\.?|circa|mehr als|ueber|\u00fcber)\s*$/i.test(before);
  }

  function dedupeCandidates(candidates) {
    var seen = {};
    var result = [];
    candidates.forEach(function addCandidate(candidate) {
      var key = candidate.source + "|" + candidate.amount + "|" + candidate.period + "|" + candidate.raw;
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      result.push(candidate);
    });
    return result;
  }

  function detectSalary(selectionText, contextText, settings) {
    var candidates = extractSalaryCandidates(selectionText, contextText, settings);
    if (candidates.length === 0) {
      return null;
    }
    candidates.sort(function byConfidence(left, right) {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.source !== right.source) {
        return left.source === "selection" ? -1 : 1;
      }
      return left.index - right.index;
    });
    return candidates[0];
  }

  function roundMoney(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function buildDisplayModel(detection, akResult) {
    var averageMonthly = akResult.net.annual !== null ? roundMoney(akResult.net.annual / 12) : null;
    var sourceLabel = akResult.source === "formula-at-2026" ? "Netto-Schätzung" : "Referenz-Netto";
    var title = sourceLabel + ": " + formatEuro(akResult.net.ongoing) + " mtl. laufend | " + formatEuro(akResult.net.annual) + " Jahr";
    var periodLabel = detection.period === "annual" ? "jährlich" : "monatlich";
    var lines = [
      "Brutto erkannt: " + formatEuro(detection.amount) + " " + periodLabel,
      "Netto laufend: " + formatEuro(akResult.net.ongoing) + " pro Monat",
      "Netto 13. Bezug: " + formatEuro(akResult.net.bonus13),
      "Netto 14. Bezug: " + formatEuro(akResult.net.bonus14),
      "Netto Jahr: " + formatEuro(akResult.net.annual),
      "Schnitt / 12 inkl. 13./14.: " + formatEuro(averageMonthly) + " pro Monat"
    ];
    if (akResult.stand) {
      lines.push((akResult.source === "formula-at-2026" ? "Berechnung: " : "Referenz-Stand: ") + akResult.stand);
    }
    if (akResult.warnings && akResult.warnings.length) {
      lines.push("Hinweis: " + akResult.warnings.join(" "));
    }
    lines.push("Annahme: 14 gleich hohe Bruttobezüge, Standardwerte aus den Optionen.");
    if (akResult.source === "formula-at-2026") {
      lines.push("Offline-Formel; Ergebnis ohne Gewähr.");
    }

    return {
      ok: true,
      title: title,
      detail: lines.join("\n"),
      copyText: lines.join("\n"),
      detection: detection,
      result: akResult,
      averageMonthly: averageMonthly
    };
  }

  function noSalaryResult() {
    return {
      ok: false,
      title: "Netto: keine Gehaltszahl erkannt",
      detail: "In der Markierung wurde keine plausible Brutto-Gehaltszahl erkannt."
    };
  }

  var api = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    BUNDESLAND_OPTIONS: BUNDESLAND_OPTIONS,
    WORK_RELATION_OPTIONS: WORK_RELATION_OPTIONS,
    mergeSettings: mergeSettings,
    normalizeWhitespace: normalizeWhitespace,
    parseLocaleNumber: parseLocaleNumber,
    formatLocaleAmount: formatLocaleAmount,
    formatEuro: formatEuro,
    hasCurrencyCue: hasCurrencyCue,
    hasSalaryWord: hasSalaryWord,
    hasAnnualCue: hasAnnualCue,
    hasMonthlyCue: hasMonthlyCue,
    hasSalaryCue: hasSalaryCue,
    inferPeriod: inferPeriod,
    extractSalaryCandidates: extractSalaryCandidates,
    detectSalary: detectSalary,
    buildDisplayModel: buildDisplayModel,
    noSalaryResult: noSalaryResult
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.GrossNetAT = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
