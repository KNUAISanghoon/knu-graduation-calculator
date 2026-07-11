const COURSE_JSON_PATH = "/db/data/courses.json";
const REQUIREMENTS_JSON_PATH = "/db/data/graduation_requirements.json";
const MINOR_PROGRAMS_JSON_PATH = "/db/data/minor_programs.json";
const DOUBLE_MAJOR_PROGRAMS_JSON_PATH = "/db/data/double_major_programs.json";
const CONVERGENCE_MAJOR_PROGRAMS_JSON_PATH = "/db/data/convergence_major_programs.json";
const STORAGE_KEY = "knu-graduation-calculator.savedCourses";
const ADMISSION_YEAR_KEY = "knu-graduation-calculator.admissionYear";
const PROGRAM_TYPE_KEY = "knu-graduation-calculator.programType";
const SPECIAL_OPTIONS_KEY = "knu-graduation-calculator.specialOptions";
const MINOR_PLAN_KEY = "knu-graduation-calculator.minorPlan";
const DOUBLE_MAJOR_PLAN_KEY = "knu-graduation-calculator.doubleMajorPlan";
const CONVERGENCE_MAJOR_PLAN_KEY = "knu-graduation-calculator.convergenceMajorPlan";

const DEFAULT_SEARCH_FILTERS = {
  type: "",
  liberalCategory: "",
  college: "",
  school: "",
  major: "",
  hideSaved: false,
};

const state = {
  courses: [],
  minorPrograms: [],
  doubleMajorPrograms: [],
  convergenceMajorPrograms: [],
  requirements: null,
  saved: [],
  query: "",
  searchFilters: { ...DEFAULT_SEARCH_FILTERS },
  admissionYear: localStorage.getItem(ADMISSION_YEAR_KEY) || "2026",
  programType: localStorage.getItem(PROGRAM_TYPE_KEY) || "singleMajor",
  specialOptions: {
    diagnosticMathScienceExempt: false,
    practicalEnglishExamPassed: false,
  },
  minorPlan: {
    count: 1,
    selected: ["", "", ""],
  },
  doubleMajorPlan: {
    count: 1,
    selected: ["", "", ""],
  },
  convergenceMajorPlan: {
    count: 1,
    selected: [""],
  },
  collapsedStatusSections: {},
};

const els = {
  admissionYearInput: document.querySelector("#admissionYearInput"),
  programTypeGroup: document.querySelector("#programTypeGroup"),
  minorConfig: document.querySelector("#minorConfig"),
  search: document.querySelector("#courseSearch"),
  courseTypeFilter: document.querySelector("#courseTypeFilter"),
  liberalCategoryFilter: document.querySelector("#liberalCategoryFilter"),
  collegeFilter: document.querySelector("#collegeFilter"),
  schoolFilter: document.querySelector("#schoolFilter"),
  majorFilter: document.querySelector("#majorFilter"),
  hideSavedFilter: document.querySelector("#hideSavedFilter"),
  resetSearchFilters: document.querySelector("#resetSearchFilters"),
  resultSummary: document.querySelector("#resultSummary"),
  dbSummary: document.querySelector("#dbSummary"),
  resultList: document.querySelector("#resultList"),
  savedList: document.querySelector("#savedList"),
  savedCount: document.querySelector("#savedCount"),
  savedCredits: document.querySelector("#savedCredits"),
  clearSaved: document.querySelector("#clearSaved"),
  customCreditForm: document.querySelector("#customCreditForm"),
  customCreditTitle: document.querySelector("#customCreditTitle"),
  customCreditValue: document.querySelector("#customCreditValue"),
  customCreditCategory: document.querySelector("#customCreditCategory"),
  programNotice: document.querySelector("#programNotice"),
  requirementsList: document.querySelector("#requirementsList"),
  specialOptions: document.querySelector("#specialOptions"),
  missingRequiredList: document.querySelector("#missingRequiredList"),
};

const animatedSelects = new WeakMap();

const INTERACTIVE_CARD_SELECTOR = [
  ".app-header",
  ".setup-pane",
  ".requirements-pane",
  ".saved-pane",
  ".requirement-card",
  ".course-row",
  ".saved-group",
  ".minor-selector",
].join(",");

function closeAnimatedSelect(except = null) {
  document.querySelectorAll(".animated-select.is-open").forEach((dropdown) => {
    if (dropdown === except) return;
    dropdown.classList.remove("is-open");
    dropdown.querySelector(".animated-select-button")?.setAttribute("aria-expanded", "false");
  });
  if (!except) {
    document.querySelectorAll(".has-open-dropdown").forEach((element) => {
      element.classList.remove("has-open-dropdown");
    });
  }
}

function elevateAnimatedSelect(dropdown) {
  document.querySelectorAll(".has-open-dropdown").forEach((element) => {
    element.classList.remove("has-open-dropdown");
  });

  [
    dropdown,
    dropdown.closest("label"),
    dropdown.closest(".search-filter-panel"),
    dropdown.closest(".minor-selector"),
    dropdown.closest(".minor-config"),
    dropdown.closest(".setup-pane"),
    dropdown.closest(".saved-pane"),
    dropdown.closest(".course-board"),
  ].filter(Boolean).forEach((element) => {
    element.classList.add("has-open-dropdown");
  });
}

function syncAnimatedSelect(select) {
  const dropdown = animatedSelects.get(select);
  if (!dropdown) return;

  const button = dropdown.querySelector(".animated-select-button");
  const list = dropdown.querySelector(".animated-select-list");
  const selectedOption = select.selectedOptions[0] || select.options[0];
  const placeholder = selectedOption?.textContent || "선택";

  dropdown.classList.toggle("is-disabled", select.disabled);
  button.disabled = select.disabled;
  button.textContent = placeholder;
  list.replaceChildren();

  [...select.options].forEach((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "animated-select-option";
    item.dataset.value = option.value;
    item.textContent = option.textContent;
    item.setAttribute("aria-selected", String(option.value === select.value));
    item.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      closeAnimatedSelect();
    });
    list.append(item);
  });
}

function enhanceAnimatedSelect(select) {
  if (!select || animatedSelects.has(select)) return;

  const dropdown = document.createElement("div");
  dropdown.className = "animated-select";
  dropdown.innerHTML = `
    <button class="animated-select-button" type="button" aria-expanded="false"></button>
    <div class="animated-select-list" role="listbox"></div>
  `;

  select.classList.add("native-select-hidden");
  select.insertAdjacentElement("afterend", dropdown);
  animatedSelects.set(select, dropdown);

  const button = dropdown.querySelector(".animated-select-button");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (select.disabled) return;
    const willOpen = !dropdown.classList.contains("is-open");
    closeAnimatedSelect(dropdown);
    dropdown.classList.toggle("is-open", willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) elevateAnimatedSelect(dropdown);
    if (!willOpen) closeAnimatedSelect();
  });

  select.addEventListener("change", () => syncAnimatedSelect(select));
  new MutationObserver(() => syncAnimatedSelect(select)).observe(select, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  syncAnimatedSelect(select);
}

function initAnimatedSelects() {
  [
    els.courseTypeFilter,
    els.liberalCategoryFilter,
    els.collegeFilter,
    els.schoolFilter,
    els.majorFilter,
    els.customCreditCategory,
  ].forEach(enhanceAnimatedSelect);

  document.addEventListener("click", () => closeAnimatedSelect());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAnimatedSelect();
  });
}

function enhanceAnimatedSelectsIn(root) {
  root.querySelectorAll("select").forEach(enhanceAnimatedSelect);
}

function initInteractiveEyeCards() {
  let activeCard = null;

  document.addEventListener("pointermove", (event) => {
    const card = event.target.closest(INTERACTIVE_CARD_SELECTOR);

    if (activeCard && activeCard !== card) {
      activeCard.classList.remove("is-eye-tracking");
    }

    activeCard = card;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    card.classList.add("is-eye-tracking");
    card.style.setProperty("--eye-x", `${Math.max(0, Math.min(100, x)).toFixed(2)}%`);
    card.style.setProperty("--eye-y", `${Math.max(0, Math.min(100, y)).toFixed(2)}%`);
    card.style.setProperty("--eye-shift-x", `${((x - 50) * 0.08).toFixed(2)}px`);
    card.style.setProperty("--eye-shift-y", `${((y - 50) * 0.08).toFixed(2)}px`);
  });

  document.addEventListener("pointerleave", () => {
    if (!activeCard) return;
    activeCard.classList.remove("is-eye-tracking");
    activeCard = null;
  });
}

function ensureMinorConfigElement() {
  if (els.minorConfig) return els.minorConfig;
  const setupPane = document.querySelector(".setup-pane");
  const container = document.createElement("div");
  container.className = "minor-config";
  container.id = "minorConfig";
  container.hidden = true;
  setupPane?.append(container);
  els.minorConfig = container;
  return container;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSearchText(value) {
  return normalize(value).replace(/\s+/g, "").replace(/학/g, "");
}

function formatCredits(value) {
  const num = Number(value || 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function loadSaved() {
  try {
    state.saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    state.saved = [];
  }

  try {
    state.specialOptions = {
      ...state.specialOptions,
      ...(JSON.parse(localStorage.getItem(SPECIAL_OPTIONS_KEY)) || {}),
    };
  } catch {
    localStorage.removeItem(SPECIAL_OPTIONS_KEY);
  }

  try {
    state.minorPlan = {
      ...state.minorPlan,
      ...(JSON.parse(localStorage.getItem(MINOR_PLAN_KEY)) || {}),
    };
    state.minorPlan.count = Math.min(Math.max(Number(state.minorPlan.count || 1), 1), 3);
    state.minorPlan.selected = [...(state.minorPlan.selected || []), "", "", ""].slice(0, 3);
  } catch {
    localStorage.removeItem(MINOR_PLAN_KEY);
  }

  try {
    state.doubleMajorPlan = {
      ...state.doubleMajorPlan,
      ...(JSON.parse(localStorage.getItem(DOUBLE_MAJOR_PLAN_KEY)) || {}),
    };
    state.doubleMajorPlan.count = 1;
    state.doubleMajorPlan.selected = [...(state.doubleMajorPlan.selected || []), ""].slice(0, 1);
  } catch {
    localStorage.removeItem(DOUBLE_MAJOR_PLAN_KEY);
  }

  try {
    state.convergenceMajorPlan = {
      ...state.convergenceMajorPlan,
      ...(JSON.parse(localStorage.getItem(CONVERGENCE_MAJOR_PLAN_KEY)) || {}),
    };
    state.convergenceMajorPlan.count = 1;
    state.convergenceMajorPlan.selected = [...(state.convergenceMajorPlan.selected || []), ""].slice(0, 1);
  } catch {
    localStorage.removeItem(CONVERGENCE_MAJOR_PLAN_KEY);
  }
}

function persistSaved() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
}

function persistSpecialOptions() {
  localStorage.setItem(SPECIAL_OPTIONS_KEY, JSON.stringify(state.specialOptions));
}

function persistMinorPlan() {
  localStorage.setItem(MINOR_PLAN_KEY, JSON.stringify(state.minorPlan));
}

function persistDoubleMajorPlan() {
  localStorage.setItem(DOUBLE_MAJOR_PLAN_KEY, JSON.stringify(state.doubleMajorPlan));
}

function persistConvergenceMajorPlan() {
  localStorage.setItem(CONVERGENCE_MAJOR_PLAN_KEY, JSON.stringify(state.convergenceMajorPlan));
}

function persistAllUserState() {
  localStorage.setItem(ADMISSION_YEAR_KEY, state.admissionYear);
  localStorage.setItem(PROGRAM_TYPE_KEY, state.programType);
  persistSaved();
  persistSpecialOptions();
  persistMinorPlan();
  persistDoubleMajorPlan();
  persistConvergenceMajorPlan();
}

function isSaved(code) {
  return state.saved.some((course) => course.code === code);
}

function getLiberalOverride(course) {
  return state.requirements?.singleMajor?.liberalCourseOverrides?.[course.code] || null;
}

function getConvergenceProgramsForCourse(course) {
  if (!course?.code) return [];
  return state.convergenceMajorPrograms.filter((program) =>
    (program.knownCourses || []).some((item) => item.code === course.code),
  );
}

function getSelectedConvergenceProgramsForCourse(course) {
  if (state.programType !== "convergenceMajor") return [];
  const selectedIds = new Set(getSelectedConvergenceMajorPrograms().map((program) => program.id));
  return getConvergenceProgramsForCourse(course).filter((program) => selectedIds.has(program.id));
}

function getSelectedMinorProgramsForCourse(course) {
  if (state.programType !== "minor") return [];
  return getSelectedMinorPrograms().filter((program) => courseMatchesMinorProgram(course, program));
}

function getSelectedDoubleMajorProgramsForCourse(course) {
  if (state.programType !== "doubleMajor") return [];
  return getSelectedDoubleMajorPrograms().filter((program) => courseMatchesProgramMajorDepartment(course, program));
}

function getCourseType(course) {
  if (course.customCredit) {
    const labels = {
      major: "직접입력 전공 인정",
      liberal: "직접입력 교양 인정",
      general: "직접입력 일반선택",
    };
    return labels[course.customCategory] || "직접입력 학점";
  }
  const minorProgram = getActiveMinorRecognitionProgram(course);
  if (minorProgram) return `부전공 인정(${getMinorProgramLabel(minorProgram)})`;
  const doubleMajorProgram = getActiveDoubleMajorRecognitionProgram(course);
  if (doubleMajorProgram) return `복수전공 인정(${getMinorProgramLabel(doubleMajorProgram)})`;
  const convergenceMajorProgram = getActiveConvergenceMajorRecognitionProgram(course);
  if (convergenceMajorProgram) return `융합전공 인정(${getMinorProgramLabel(convergenceMajorProgram)})`;
  const selectedMinorPrograms = getSelectedMinorProgramsForCourse(course);
  if (selectedMinorPrograms.length && !isAiMajorCreditCandidate(course)) {
    return `부전공(${getMinorProgramLabel(selectedMinorPrograms[0])})`;
  }
  const selectedDoubleMajorPrograms = getSelectedDoubleMajorProgramsForCourse(course);
  if (selectedDoubleMajorPrograms.length && !isAiMajorCreditCandidate(course)) {
    return `복수전공(${getMinorProgramLabel(selectedDoubleMajorPrograms[0])})`;
  }
  const selectedConvergencePrograms = getSelectedConvergenceProgramsForCourse(course);
  if (selectedConvergencePrograms.length && !isAiMajorCreditCandidate(course)) {
    return `융합전공(${getMinorProgramLabel(selectedConvergencePrograms[0])})`;
  }
  if (isLiberalCredit(course)) {
    const label = course.liberalCategoryName || getLiberalCategoryLabel(course);
    const sdg = isSdgCourse(course) ? " · SDG" : "";
    return label ? `교양(${label}${sdg})` : `교양${sdg}`;
  }
  if (isAiMajorRequiredCourse(course)) return "전공필수";
  if (isAiMajorMajorCourse(course)) return "전공";
  if (course.majorRecognized) return "전공 인정(타학과 전공)";
  if ((course.classTypes || []).some((type) => type.includes("전공"))) return "일반선택(타학과 전공)";
  if (course.flags?.generalElective) return "일반선택";
  return course.classTypes?.[0] || "미분류";
}

function orderedDepartmentsForDisplay(course) {
  const departments = course.departments || [];
  const priority = ["전자공학부 인공지능전공", "전자공학부", course.hostDepartment].filter(Boolean);
  return [
    ...priority.filter((department) => departments.includes(department)),
    ...departments.filter((department) => !priority.includes(department)),
  ];
}

function appendPill(container, label, className = "") {
  if (!label) return;
  const pill = document.createElement("span");
  pill.className = `pill${className ? ` ${className}` : ""}`;
  pill.textContent = label;
  container.append(pill);
}

function renderCourseTags(container, course) {
  container.replaceChildren();
  if (course.customCredit) {
    appendPill(container, "외부 인정 학점", "program");
    appendPill(container, getCourseType(course));
    return;
  }
  if (isLiberalCredit(course)) {
    [
      getLiberalCategoryLabel(course),
      getLiberalDetail(course),
      isSdgCourse(course) ? "SDG" : "",
    ].forEach((label) => appendPill(container, label));
    return;
  }

  const selectedMinorPrograms = getSelectedMinorProgramsForCourse(course);
  selectedMinorPrograms.forEach((program) => {
    appendPill(container, `${getMinorProgramLabel(program)} 부전공`, "program");
  });

  const selectedDoubleMajorPrograms = getSelectedDoubleMajorProgramsForCourse(course);
  selectedDoubleMajorPrograms.forEach((program) => {
    appendPill(container, `${getMinorProgramLabel(program)} 복수전공`, "program");
  });

  const selectedConvergencePrograms = getSelectedConvergenceProgramsForCourse(course);
  selectedConvergencePrograms.forEach((program) => {
    appendPill(container, `${program.name} 인정과목`, "convergence");
  });

  const departments = orderedDepartmentsForDisplay(course);
  departments.slice(0, 2).forEach((department) => appendPill(container, department));
  const hidden = departments.slice(2);
  if (!hidden.length) return;

  const hiddenPills = hidden.map((department) => {
    const pill = document.createElement("span");
    pill.className = "pill department-extra";
    pill.textContent = department;
    pill.classList.add("is-hidden");
    container.append(pill);
    return pill;
  });

  const toggle = document.createElement("button");
  toggle.className = "pill more-pill";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.title = `나머지 ${hidden.length}개 학과 보기`;
  toggle.innerHTML = `
    <span class="more-pill-count">+${hidden.length}</span>
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  `;
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    hiddenPills.forEach((pill) => {
      pill.classList.toggle("is-hidden", expanded);
    });
    toggle.setAttribute("aria-expanded", String(!expanded));
    toggle.title = expanded ? `나머지 ${hidden.length}개 학과 보기` : "학과 접기";
    container.append(toggle);
  });
  container.append(toggle);
}

function isAiMajorCourse(course) {
  return (course.departments || []).some((name) => name.includes("전자공학부 인공지능전공"));
}

function isAiMajorRequiredCourse(course) {
  return Boolean(
    state.requirements?.singleMajor?.majorRequiredCourses?.some((item) => item.code === course.code),
  );
}

function isAiMajorMajorCourse(course) {
  return Boolean(
    isAiMajorCourse(course)
      && (course.classTypes || []).some((type) => type === "전공" || type === "전공필수"),
  );
}

function isAiMajorCreditCandidate(course) {
  return Boolean(isAiMajorRequiredCourse(course) || isAiMajorMajorCourse(course));
}

function isLiberalCredit(course) {
  if (course.customCredit) return course.customCategory === "liberal";
  return Boolean(course.flags?.liberalArts || course.code.startsWith("CLTR"));
}

function isMajorCredit(course) {
  if (course.customCredit) return course.customCategory === "major";
  if (isLiberalCredit(course)) return false;
  if (getActiveMinorRecognitionProgram(course)) return false;
  if (getActiveDoubleMajorRecognitionProgram(course)) return false;
  if (getActiveConvergenceMajorRecognitionProgram(course)) return false;
  if (course.majorRecognized) return true;
  return isAiMajorCreditCandidate(course);
}

function isGeneralElectiveCredit(course) {
  if (course.customCredit) return course.customCategory === "general";
  return Boolean(
    !isMajorCredit(course)
      && !isLiberalCredit(course)
      && !(state.programType === "minor" && isSelectedMinorCourse(course))
      && !(state.programType === "doubleMajor" && isSelectedDoubleMajorCourse(course))
      && !(state.programType === "convergenceMajor" && isSelectedConvergenceCourse(course)),
  );
}

function isSdgCourse(course) {
  const override = getLiberalOverride(course);
  return Boolean(override?.sdg || course.flags?.sdg);
}

function getLiberalCategory(course) {
  const override = getLiberalOverride(course);
  return override?.category || course.liberalCategory;
}

function getLiberalDetail(course) {
  const override = getLiberalOverride(course);
  return override?.detail || course.liberalDetail || course.liberalDetailName || "";
}

function getLiberalCategoryLabel(course) {
  const category = getLiberalCategory(course);
  const labels = {
    basic: "첨성인기초",
    core: "첨성인핵심",
    soyang: "첨성인소양",
  };
  return labels[category] || "";
}

function normalizeLiberalDetail(value) {
  return normalize(value).replace(/\s+/g, "").replace(/[·•]/g, "");
}

function matchesLiberalDetails(course, details) {
  const courseDetail = normalizeLiberalDetail(getLiberalDetail(course));
  return details.some((detail) => normalizeLiberalDetail(detail) === courseDetail);
}

function getSavedCategory(course) {
  if (
    getActiveMinorRecognitionProgram(course)
      || (state.programType === "minor" && isSelectedMinorCourse(course) && !isAiMajorCreditCandidate(course))
  ) {
    return "minor";
  }
  if (
    getActiveDoubleMajorRecognitionProgram(course)
      || (state.programType === "doubleMajor" && isSelectedDoubleMajorCourse(course) && !isAiMajorCreditCandidate(course))
  ) {
    return "doubleMajor";
  }
  if (
    getActiveConvergenceMajorRecognitionProgram(course)
      || (state.programType === "convergenceMajor" && isSelectedConvergenceCourse(course) && !isAiMajorCreditCandidate(course))
  ) {
    return "convergence";
  }
  if (isMajorCredit(course)) return "major";
  if (isLiberalCredit(course)) return "liberal";
  return "general";
}

function canRecognizeAsMajor(course) {
  return Boolean(
    !isLiberalCredit(course)
      && !getActiveMinorRecognitionProgram(course)
      && !getActiveDoubleMajorRecognitionProgram(course)
      && !getActiveConvergenceMajorRecognitionProgram(course)
      && !(state.programType === "minor" && isSelectedMinorCourse(course))
      && !(state.programType === "doubleMajor" && isSelectedDoubleMajorCourse(course))
      && !(state.programType === "convergenceMajor" && isSelectedConvergenceCourse(course))
      && !isAiMajorRequiredCourse(course)
      && !isAiMajorMajorCourse(course)
      && (course.classTypes || []).some((type) => type.includes("전공")),
  );
}

function getRequirementSet() {
  const base = state.requirements?.singleMajor?.byAdmissionYear?.[state.admissionYear];
  if (!base) return null;
  if (state.programType === "doubleMajor") {
    const majorCredits = getMajorCreditRule("doubleMajor");
    const doubleMajorCredits = getSelectedDoubleMajorPrograms().reduce(
      (sum, program) => sum + getDoubleMajorRequiredCredits(program),
      0,
    );
    return {
      ...base,
      majorCredits,
      doubleMajorCredits,
      totalCredits: Math.max(base.totalCredits, majorCredits + base.liberalCredits + doubleMajorCredits),
    };
  }
  if (state.programType === "convergenceMajor") {
    const majorCredits = getMajorCreditRule("convergenceMajor");
    const convergenceMajorCredits = getSelectedConvergenceMajorPrograms().reduce(
      (sum, program) => sum + Number(program.requiredCredits || 36),
      0,
    );
    return {
      ...base,
      majorCredits,
      convergenceMajorCredits,
      totalCredits: Math.max(base.totalCredits, majorCredits + base.liberalCredits + convergenceMajorCredits),
    };
  }
  if (state.programType !== "minor") return base;
  const majorCredits = state.minorPlan.count >= 2
    ? getMajorCreditRule("twoOrMoreMinors")
    : getMajorCreditRule("oneMinor");
  const minorCredits = 24 * state.minorPlan.count;
  const totalCredits = Math.max(base.totalCredits, majorCredits + base.liberalCredits + minorCredits);
  return {
    ...base,
    majorCredits,
    minorCredits,
    totalCredits,
  };
}

function getSupportedYears() {
  return Object.keys(state.requirements?.singleMajor?.byAdmissionYear || {}).sort();
}

function isSupportedAdmissionYear() {
  return getSupportedYears().includes(state.admissionYear);
}

function getMajorCreditRule(ruleName) {
  const yearlyRules = state.requirements?.singleMajor?.byAdmissionYear?.[state.admissionYear]?.majorCreditRules;
  const globalRules = state.requirements?.singleMajor?.majorCreditRules;
  return Number(yearlyRules?.[ruleName] ?? globalRules?.[ruleName] ?? 0);
}

function sumCredits(courses, predicate) {
  return courses.reduce((sum, course) => {
    if (!predicate(course)) return sum;
    return sum + Number(course.credits || 0);
  }, 0);
}

function countProgress(label, current, required, detail, children = []) {
  return {
    label,
    current,
    required,
    detail,
    children,
    complete: children.length
      ? children.every((child) => child.complete)
      : required <= 0 ? current > 0 : current >= required,
  };
}

function requirementSummary(req) {
  const sdgText = req.sdgCredits > 0 ? `SDG ${req.sdgCredits}학점` : "SDG 별도요건 없음";
  const programLabel = state.programType === "minor"
    ? `부전공 ${state.minorPlan.count}개`
    : state.programType === "doubleMajor"
      ? "복수전공"
      : state.programType === "convergenceMajor"
        ? "융합전공"
      : "단일전공";
  const minorText = state.programType === "minor"
    ? `<span>부전공 ${req.minorCredits}학점</span>`
    : state.programType === "doubleMajor"
      ? `<span>복수전공 ${req.doubleMajorCredits}학점</span>`
    : state.programType === "convergenceMajor"
      ? `<span>융합전공 ${req.convergenceMajorCredits}학점</span>`
    : "";
  const totalDetail = ["minor", "doubleMajor", "convergenceMajor"].includes(state.programType) && req.totalCredits > 133
    ? `<span>필수 구성학점 합산 기준</span>`
    : "";
  return `
    <div class="summary-title">${state.admissionYear}학번 ${programLabel} 졸업요건</div>
    <div class="summary-grid">
      <span>총 ${req.totalCredits}학점</span>
      <span>전공 ${req.majorCredits}학점</span>
      <span>전공필수 ${req.majorRequiredCredits}학점</span>
      <span>교양 ${req.liberalCredits}학점</span>
      <span>${sdgText}</span>
      <span>실용영어 4학점 또는 대체기준</span>
      ${minorText}
      ${totalDetail}
    </div>
  `;
}

function liberalGroupProgress(group, category, courses) {
  if (group.courseCodes?.length) {
    const current = sumCredits(
      courses,
      (course) => isLiberalCredit(course) && group.courseCodes.includes(course.code),
    );
    return countProgress(group.label, current, group.requiredCredits, group.courseCodes.join(", "));
  }

  if (group.exemptionKey && state.specialOptions[group.exemptionKey]) {
    return {
      ...countProgress(group.label, group.requiredCredits, group.requiredCredits, "진단평가 A 결과 면제"),
      exempt: true,
    };
  }

  const current = sumCredits(
    courses,
    (course) =>
      isLiberalCredit(course)
        && getLiberalCategory(course) === category
        && matchesLiberalDetails(course, group.details),
  );
  return countProgress(group.label, current, group.requiredCredits, group.details.join(", "));
}

function getSelectedMinorPrograms() {
  return state.minorPlan.selected
    .slice(0, state.minorPlan.count)
    .map((id) => state.minorPrograms.find((program) => program.id === id))
    .filter(Boolean);
}

function getSelectedDoubleMajorPrograms() {
  return state.doubleMajorPlan.selected
    .slice(0, state.doubleMajorPlan.count)
    .map((id) => state.doubleMajorPrograms.find((program) => program.id === id))
    .filter(Boolean);
}

function getSelectedConvergenceMajorPrograms() {
  return state.convergenceMajorPlan.selected
    .slice(0, state.convergenceMajorPlan.count)
    .map((id) => state.convergenceMajorPrograms.find((program) => program.id === id))
    .filter(Boolean);
}

function isSelectedConvergenceCourse(course) {
  return getSelectedConvergenceProgramsForCourse(course).length > 0;
}

function isSelectedMinorCourse(course) {
  return getSelectedMinorProgramsForCourse(course).length > 0;
}

function isSelectedDoubleMajorCourse(course) {
  return getSelectedDoubleMajorProgramsForCourse(course).length > 0;
}

function getDoubleMajorEffectiveAdmissionYear(program) {
  const byYear = program?.requiredCreditsByAdmissionYear || {};
  if (byYear[state.admissionYear]) return state.admissionYear;

  const years = Object.keys(byYear).sort();
  if (!years.length) return state.admissionYear;

  const admissionYear = Number(state.admissionYear);
  const firstYear = Number(years[0]);
  if (admissionYear <= firstYear) return years[0];

  return years
    .filter((year) => Number(year) <= admissionYear)
    .at(-1) || years.at(-1);
}

function getDoubleMajorRequiredCredits(program) {
  const effectiveYear = getDoubleMajorEffectiveAdmissionYear(program);
  return Number(program?.requiredCreditsByAdmissionYear?.[effectiveYear] || 0);
}

function getMinorProgramLabel(program) {
  if (!program) return "";
  return [program.school, program.major].filter(Boolean).join(" ") || program.id;
}

function courseMatchesMinorProgram(course, program) {
  const matches = program.matchDepartments?.length ? program.matchDepartments : [program.department];
  return matches.some((department) => (course.majorDepartments || []).includes(department));
}

function getActiveMinorRecognitionProgram(course) {
  if (state.programType !== "minor") return null;
  if (!course.minorRecognizedFor) return null;
  return getSelectedMinorPrograms().find((program) => program.id === course.minorRecognizedFor) || null;
}

function getActiveDoubleMajorRecognitionProgram(course) {
  if (state.programType !== "doubleMajor") return null;
  if (!course.doubleMajorRecognizedFor) return null;
  return getSelectedDoubleMajorPrograms().find((program) => program.id === course.doubleMajorRecognizedFor) || null;
}

function getActiveConvergenceMajorRecognitionProgram(course) {
  if (state.programType !== "convergenceMajor") return null;
  if (!course.convergenceMajorRecognizedFor) return null;
  return getSelectedConvergenceMajorPrograms().find((program) => program.id === course.convergenceMajorRecognizedFor) || null;
}

function getMinorRecognitionTargets(course) {
  if (state.programType !== "minor" || !isAiMajorCreditCandidate(course)) return [];
  return getSelectedMinorPrograms().filter((program) => courseMatchesMinorProgram(course, program));
}

function getDoubleMajorRecognitionTargets(course) {
  if (state.programType !== "doubleMajor" || !isAiMajorCreditCandidate(course)) return [];
  return getSelectedDoubleMajorPrograms().filter((program) => courseMatchesProgramMajorDepartment(course, program));
}

function getConvergenceMajorRecognitionTargets(course) {
  if (state.programType !== "convergenceMajor" || !isAiMajorCreditCandidate(course)) return [];
  return getSelectedConvergenceMajorPrograms().filter((program) => courseMatchesConvergenceMajorProgram(course, program));
}

function isMinorMajorCredit(course, program) {
  if (!courseMatchesMinorProgram(course, program)) return false;
  if (course.majorRecognized) return false;
  if (isAiMajorCreditCandidate(course)) return course.minorRecognizedFor === program.id;
  return true;
}

function isDoubleMajorCredit(course, program) {
  if (isLiberalCredit(course)) return false;
  if (!courseMatchesProgramMajorDepartment(course, program)) return false;
  if (course.majorRecognized) return false;
  if (isAiMajorCreditCandidate(course)) return course.doubleMajorRecognizedFor === program.id;
  return true;
}

function isConvergenceMajorCredit(course, program) {
  if (isLiberalCredit(course)) return false;
  if (!courseMatchesConvergenceMajorProgram(course, program)) return false;
  if (course.majorRecognized) return false;
  if (isAiMajorCreditCandidate(course)) return course.convergenceMajorRecognizedFor === program.id;
  return true;
}

function getConvergenceMajorCourseCredits(course, program) {
  const officialCourse = (program.knownCourses || []).find((item) => item.code === course.code);
  return Number(officialCourse?.credits || course.credits || 0);
}

function sumConvergenceMajorCredits(program) {
  return state.saved.reduce((sum, course) => {
    if (!isConvergenceMajorCredit(course, program)) return sum;
    return sum + getConvergenceMajorCourseCredits(course, program);
  }, 0);
}

function createSyntheticConvergenceCourse(program, knownCourse) {
  return {
    code: knownCourse.code,
    name: knownCourse.name,
    credits: Number(knownCourse.credits || 0),
    flags: {
      major: true,
      liberalArts: false,
      majorRequired: false,
      generalElective: false,
      sdg: false,
    },
    liberalCategory: null,
    firstSeenYear: knownCourse.years?.[0] || program.firstAvailableYear || 2026,
    lastSeenYear: knownCourse.years?.[knownCourse.years.length - 1] || program.firstAvailableYear || 2026,
    offeringCount: 0,
    offeredYears: knownCourse.years || [],
    offeredSemesters: knownCourse.semesterCode ? [knownCourse.semesterCode] : [],
    classTypes: ["융합전공"],
    departments: [program.name],
    majorDepartments: [program.name],
    hostDepartment: program.hostDepartment || program.department,
    fromConvergenceCurriculum: true,
  };
}

function mergeConvergenceCoursesIntoCourseDb(courses, programs) {
  const byCode = new Map(courses.map((course) => [course.code, { ...course }]));

  programs.forEach((program) => {
    (program.knownCourses || []).forEach((knownCourse) => {
      if (!knownCourse.code) return;
      const existing = byCode.get(knownCourse.code);
      if (!existing) {
        byCode.set(knownCourse.code, createSyntheticConvergenceCourse(program, knownCourse));
        return;
      }

      const departments = new Set([...(existing.departments || []), program.name]);
      const majorDepartments = new Set([...(existing.majorDepartments || []), program.name]);
      const classTypes = new Set([...(existing.classTypes || []), "융합전공"]);
      byCode.set(knownCourse.code, {
        ...existing,
        credits: existing.credits || Number(knownCourse.credits || 0),
        departments: [...departments],
        majorDepartments: [...majorDepartments],
        classTypes: [...classTypes],
      });
    });
  });

  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function calculateGraduationStatus() {
  const req = getRequirementSet();
  const singleMajor = state.requirements?.singleMajor;
  if (!req || !singleMajor) return null;

  const savedCodes = new Set(state.saved.map((course) => course.code));
  const totalCredits = sumCredits(state.saved, () => true);
  const majorCredits = sumCredits(state.saved, isMajorCredit);
  const liberalCredits = sumCredits(state.saved, isLiberalCredit);
  const sdgCredits = sumCredits(state.saved, isSdgCourse);
  const basicCredits = sumCredits(
    state.saved,
    (course) => isLiberalCredit(course) && getLiberalCategory(course) === "basic",
  );
  const coreCredits = sumCredits(
    state.saved,
    (course) => isLiberalCredit(course) && getLiberalCategory(course) === "core",
  );
  const practicalEnglishCredits = sumCredits(
    state.saved,
    (course) =>
      isLiberalCredit(course)
        && normalizeLiberalDetail(getLiberalDetail(course))
          === normalizeLiberalDetail(singleMajor.practicalEnglish.liberalDetail),
  );
  const practicalEnglishCurrent = state.specialOptions.practicalEnglishExamPassed
    ? singleMajor.practicalEnglish.requiredCredits
    : practicalEnglishCredits;

  const missingRequired = singleMajor.majorRequiredCourses.filter(
    (course) => !savedCodes.has(course.code),
  );
  const requiredMajorCredits = singleMajor.majorRequiredCredits
    || singleMajor.majorRequiredCourses.reduce((sum, course) => sum + Number(course.credits || 0), 0);
  const completedRequiredMajorCredits = singleMajor.majorRequiredCourses.reduce((sum, course) => {
    if (!savedCodes.has(course.code)) return sum;
    return sum + Number(course.credits || 0);
  }, 0);
  const basicGroupRows = singleMajor.liberalAreaRequirements.basicGroups.map((group) =>
    liberalGroupProgress(group, "basic", state.saved),
  );
  const coreGroupRows = singleMajor.liberalAreaRequirements.coreGroups.map((group) =>
    liberalGroupProgress(group, "core", state.saved),
  );
  const minorRows = state.programType === "minor"
    ? getSelectedMinorPrograms().map((program) =>
        countProgress(
          `${program.major || program.school} 부전공`,
          sumCredits(state.saved, (course) => isMinorMajorCredit(course, program)),
          24,
          program.college,
        ),
      )
    : [];
  const doubleMajorRows = state.programType === "doubleMajor"
    ? getSelectedDoubleMajorPrograms().map((program) =>
        countProgress(
          `${program.major || program.school} 복수전공`,
          sumCredits(state.saved, (course) => isDoubleMajorCredit(course, program)),
          getDoubleMajorRequiredCredits(program),
          `${program.college} · ${getDoubleMajorEffectiveAdmissionYear(program)}학년도 기준`,
        ),
      )
    : [];
  const convergenceMajorRows = state.programType === "convergenceMajor"
    ? getSelectedConvergenceMajorPrograms().map((program) =>
        countProgress(
          `${program.major || program.name} 융합전공`,
          sumConvergenceMajorCredits(program),
          Number(program.requiredCredits || 36),
          [program.college, program.department].filter(Boolean).join(" · ") || "주관학과 확인 필요",
        ),
      )
    : [];
  const requiredFixedCredits = req.majorCredits
    + req.liberalCredits
    + (state.programType === "minor" ? req.minorCredits : 0)
    + (state.programType === "doubleMajor" ? req.doubleMajorCredits : 0)
    + (state.programType === "convergenceMajor" ? req.convergenceMajorCredits : 0);
  const flexibleRequiredCredits = Math.max(req.totalCredits - requiredFixedCredits, 0);
  const flexibleCurrentCredits = Math.min(
    totalCredits,
    Math.max(
      totalCredits
        - Math.min(majorCredits, req.majorCredits)
        - Math.min(liberalCredits, req.liberalCredits)
        - minorRows.reduce((sum, row) => sum + Math.min(row.current, row.required), 0)
        - doubleMajorRows.reduce((sum, row) => sum + Math.min(row.current, row.required), 0)
        - convergenceMajorRows.reduce((sum, row) => sum + Math.min(row.current, row.required), 0),
      0,
    ),
  );

  const rows = [
    countProgress("총 졸업학점", totalCredits, req.totalCredits, "전체 저장 과목 기준"),
    countProgress("전공학점", majorCredits, req.majorCredits, "인공지능전공 개설 전공 및 수동 인정 과목"),
    countProgress("교양학점", liberalCredits, req.liberalCredits, "CLTR 또는 교양 과목 기준"),
    countProgress(
      "전공필수",
      completedRequiredMajorCredits,
      requiredMajorCredits,
      "전자공학부 인공지능전공 전공필수 16개",
    ),
    countProgress("첨성인기초", basicCredits, singleMajor.liberalAreaRequirements.basic, "두 영역 각 3학점 필요", basicGroupRows),
    countProgress("첨성인핵심", coreCredits, singleMajor.liberalAreaRequirements.core, "두 영역 각 3학점 필요", coreGroupRows),
  ];

  if (flexibleRequiredCredits > 0) {
    rows.splice(
      3,
      0,
      countProgress(
        "남은 학점",
        flexibleCurrentCredits,
        flexibleRequiredCredits,
        "전공/교양/다전공 요건을 채운 뒤 총 졸업학점까지 자유롭게 채우는 학점",
      ),
    );
  }

  if (req.sdgCredits > 0) {
    rows.push(countProgress("SDG교양", sdgCredits, req.sdgCredits, "2024학번 이후 적용"));
  }

  rows.push(...minorRows);
  rows.push(...doubleMajorRows);
  rows.push(...convergenceMajorRows);

  rows.push(
    countProgress(
      "실용영어",
      practicalEnglishCurrent,
      singleMajor.practicalEnglish.requiredCredits,
      state.specialOptions.practicalEnglishExamPassed
        ? "공인영어성적 등 대체기준으로 충족"
        : practicalEnglishCredits >= singleMajor.practicalEnglish.requiredCredits
        ? "실용영어 학점으로 충족"
        : "부족하면 공인영어성적 등 대체기준 필요",
    ),
  );

  return {
    rows,
    missingRequired,
  };
}

function renderSegmentedControls() {
  const buttons = [...els.programTypeGroup.querySelectorAll("button")];
  const activeIndex = Math.max(0, buttons.findIndex((button) => button.dataset.program === state.programType));
  els.programTypeGroup.style.setProperty("--segment-count", String(buttons.length || 1));
  els.programTypeGroup.style.setProperty("--segment-index", String(activeIndex));

  buttons.forEach((button) => {
    const program = state.requirements?.programs?.[button.dataset.program];
    const implementedPrograms = new Set(["singleMajor", "minor", "doubleMajor", "convergenceMajor"]);
    const implemented = implementedPrograms.has(button.dataset.program) || Boolean(program?.implemented);
    button.setAttribute("aria-pressed", String(button.dataset.program === state.programType));
    button.disabled = !implemented;
    button.title = implemented ? "" : "아직 준비 중";
  });
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function hasActiveSearchFilters() {
  return Object.entries(state.searchFilters).some(([key, value]) =>
    key === "hideSaved" ? value : Boolean(value),
  );
}

function filterOptionMarkup(values, selected, placeholder = "전체") {
  return [
    `<option value="">${placeholder}</option>`,
    ...values.map((value) => `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${value}</option>`),
  ].join("");
}

function getDepartmentProgramsForFilters() {
  return state.minorPrograms.filter((program) =>
    !state.searchFilters.college || program.college === state.searchFilters.college,
  );
}

function getSelectedDepartmentPrograms() {
  return state.minorPrograms.filter((program) =>
    (!state.searchFilters.college || program.college === state.searchFilters.college)
      && (!state.searchFilters.school || program.school === state.searchFilters.school)
      && (!state.searchFilters.major || program.id === state.searchFilters.major),
  );
}

function populateSearchFilterOptions() {
  const collegePrograms = getDepartmentProgramsForFilters();
  const schools = uniqueSorted(collegePrograms.map((program) => program.school));
  const majors = state.minorPrograms.filter((program) =>
    (!state.searchFilters.college || program.college === state.searchFilters.college)
      && (!state.searchFilters.school || program.school === state.searchFilters.school),
  );

  els.collegeFilter.innerHTML = filterOptionMarkup(
    uniqueSorted(state.minorPrograms.map((program) => program.college)),
    state.searchFilters.college,
  );
  els.schoolFilter.innerHTML = filterOptionMarkup(schools, state.searchFilters.school);
  els.majorFilter.innerHTML = filterOptionMarkup(
    majors.map((program) => program.id),
    state.searchFilters.major,
  );
}

function syncSearchFilterControls() {
  const liberalOnly = state.searchFilters.type === "liberal";
  const majorLike = ["aiMajor", "otherMajor", ""].includes(state.searchFilters.type);

  if (!liberalOnly && state.searchFilters.liberalCategory) {
    state.searchFilters.liberalCategory = "";
  }
  if (!majorLike && (state.searchFilters.college || state.searchFilters.school || state.searchFilters.major)) {
    state.searchFilters.college = "";
    state.searchFilters.school = "";
    state.searchFilters.major = "";
  }

  populateSearchFilterOptions();
  els.courseTypeFilter.value = state.searchFilters.type;
  els.liberalCategoryFilter.value = state.searchFilters.liberalCategory;
  els.liberalCategoryFilter.disabled = !liberalOnly;
  els.collegeFilter.value = state.searchFilters.college;
  els.schoolFilter.value = state.searchFilters.school;
  els.majorFilter.value = state.searchFilters.major;
  els.collegeFilter.disabled = !majorLike;
  els.schoolFilter.disabled = !majorLike || !state.searchFilters.college;
  els.majorFilter.disabled = !majorLike || !state.searchFilters.school;
  els.hideSavedFilter.checked = state.searchFilters.hideSaved;
  [
    els.courseTypeFilter,
    els.liberalCategoryFilter,
    els.collegeFilter,
    els.schoolFilter,
    els.majorFilter,
  ].forEach(syncAnimatedSelect);
}

function selectOptions(values, selected, placeholder) {
  return [
    `<option value="">${placeholder}</option>`,
    ...values.map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`),
  ].join("");
}

function getProgramSelectionContext() {
  if (state.programType === "minor") {
    return {
      active: true,
      label: "부전공",
      programs: state.minorPrograms,
      plan: state.minorPlan,
      persist: persistMinorPlan,
    };
  }
  if (state.programType === "doubleMajor") {
    return {
      active: true,
      label: "복수전공",
      heading: "복수전공 선택",
      description: "복수전공은 하나만 선택할 수 있어요. 선택한 학과의 학번별 전공학점 기준으로 계산합니다.",
      programs: state.doubleMajorPrograms,
      plan: state.doubleMajorPlan,
      persist: persistDoubleMajorPlan,
      fixedCount: true,
    };
  }
  if (state.programType === "convergenceMajor") {
    return {
      active: true,
      label: "융합전공",
      heading: "융합전공 선택",
      description: "융합전공은 하나만 선택할 수 있어요. 선택한 융합전공의 36학점 기준으로 계산합니다.",
      programs: state.convergenceMajorPrograms,
      plan: state.convergenceMajorPlan,
      persist: persistConvergenceMajorPlan,
      fixedCount: true,
    };
  }
  return { active: false };
}

function renderMinorConfig() {
  const context = getProgramSelectionContext();
  const minorConfig = ensureMinorConfigElement();
  minorConfig.hidden = !context.active;
  minorConfig.replaceChildren();
  if (!context.active) return;

  const { label, programs, plan, persist } = context;

  if (context.fixedCount) {
    plan.count = 1;
    plan.selected = [...(plan.selected || []), ""].slice(0, 1);
    persist();
  }

  if (!context.fixedCount) {
    const countField = document.createElement("label");
    countField.className = "minor-count-field";
    countField.innerHTML = `
      <span>${label} 개수</span>
      <select id="minorCountSelect">
        ${[1, 2, 3].map((count) => `<option value="${count}" ${count === plan.count ? "selected" : ""}>${count}개</option>`).join("")}
      </select>
    `;
    countField.querySelector("select").addEventListener("change", (event) => {
      plan.count = Number(event.target.value);
      persist();
      render();
    });
    minorConfig.append(countField);
  } else {
    const intro = document.createElement("div");
    intro.className = "single-program-intro";
    intro.innerHTML = `
      <div>
        <strong>${context.heading || `${label} 선택`}</strong>
        <p>${context.description || `${label}은 하나만 선택할 수 있어요.`}</p>
      </div>
      <span>1개 선택</span>
    `;
    minorConfig.append(intro);
  }

  const caution = document.createElement("div");
  caution.className = "program-caution";
  caution.innerHTML = `
    <strong>확인 필요</strong>
    <span>${label}은 학과별로 필수 이수과목이나 세부 교육과정 요건이 별도로 있을 수 있어요. 이 계산기는 우선 학점 기준을 중심으로 계산하므로, 선택한 전공의 공식 교육과정표를 반드시 직접 확인해 주세요.</span>
  `;
  minorConfig.append(caution);

  const grid = document.createElement("div");
  grid.className = "minor-selector-grid";
  if (context.fixedCount) grid.classList.add("single-program-grid");
  const colleges = uniqueSorted(programs.map((program) => program.college));

  for (let index = 0; index < plan.count; index += 1) {
    const selectedId = plan.selected[index] || "";
    const selectedProgram = programs.find((program) => program.id === selectedId);
    const selectedCollege = selectedProgram?.college || "";
    const selectedSchool = selectedProgram?.school || "";
    const selectedMajor = selectedProgram?.id || "";
    const schools = uniqueSorted(
      programs
        .filter((program) => !selectedCollege || program.college === selectedCollege)
        .map((program) => program.school),
    );
    const majors = programs.filter(
      (program) =>
        (!selectedCollege || program.college === selectedCollege)
          && (!selectedSchool || program.school === selectedSchool),
    );

    const card = document.createElement("section");
    card.className = "minor-selector";
    if (context.fixedCount) card.classList.add("single-program-selector");
    card.innerHTML = `
      <h3>${context.fixedCount ? (context.heading || `${label} 선택`) : `${label} ${index + 1}`}</h3>
      <label>
        <span>단과대학</span>
        <select data-index="${index}" data-field="college">
          ${selectOptions(colleges, selectedCollege, "단과대학 선택")}
        </select>
      </label>
      <label>
        <span>학부/학과</span>
        <select data-index="${index}" data-field="school">
          ${selectOptions(schools, selectedSchool, "학부/학과 선택")}
        </select>
      </label>
      <label>
        <span>전공</span>
        <select data-index="${index}" data-field="major">
          ${selectOptions(
            majors.map((program) => program.id),
            selectedMajor,
            "전공 선택",
          )}
        </select>
      </label>
    `;
    card.querySelectorAll("select").forEach((select) => {
      select.addEventListener("change", (event) => {
        const field = event.target.dataset.field;
        const value = event.target.value;
        if (field === "major") {
          plan.selected[index] = value;
        } else if (field === "college") {
          const first = programs.find((program) => program.college === value);
          plan.selected[index] = first?.id || "";
        } else if (field === "school") {
          const first = programs.find(
            (program) => program.college === selectedCollege && program.school === value,
          );
          plan.selected[index] = first?.id || "";
        }
        persist();
        render();
      });
    });
    grid.append(card);
  }
  minorConfig.append(grid);
  enhanceAnimatedSelectsIn(minorConfig);
}

function courseMatchesTypeFilter(course, type) {
  if (!type) return true;
  if (type === "aiMajor") return isAiMajorCreditCandidate(course);
  if (type === "convergence") return isSelectedConvergenceCourse(course);
  if (type === "otherMajor") {
    return Boolean(
      !isLiberalCredit(course)
        && !isAiMajorCreditCandidate(course)
        && !isSelectedMinorCourse(course)
        && !isSelectedDoubleMajorCourse(course)
        && !isSelectedConvergenceCourse(course)
        && (course.classTypes || []).some((item) => item.includes("전공")),
    );
  }
  if (type === "liberal") return isLiberalCredit(course);
  if (type === "general") return isGeneralElectiveCredit(course);
  return true;
}

function courseMatchesDepartmentProgram(course, program) {
  const targets = program.matchDepartments?.length
    ? program.matchDepartments
    : [program.department, program.school, program.major];
  const courseDepartments = [
    course.hostDepartment,
    ...(course.departments || []),
    ...(course.majorDepartments || []),
  ];
  return targets.some((target) => courseDepartments.includes(target));
}

function courseMatchesProgramMajorDepartment(course, program) {
  if ((program.knownCourses || []).some((item) => item.code === course.code)) return true;
  const targets = program.matchDepartments?.length
    ? program.matchDepartments
    : [program.department, program.school, program.major];
  return targets.some((target) => (course.majorDepartments || []).includes(target));
}

function courseMatchesConvergenceMajorProgram(course, program) {
  return (program.knownCourses || []).some((item) => item.code === course.code);
}

function courseMatchesFilters(course) {
  const filters = state.searchFilters;
  if (!courseMatchesTypeFilter(course, filters.type)) return false;
  if (filters.liberalCategory) {
    if (filters.liberalCategory === "sdg") {
      if (!isSdgCourse(course)) return false;
    } else if (getLiberalCategory(course) !== filters.liberalCategory) {
      return false;
    }
  }
  if (filters.college || filters.school || filters.major) {
    const programs = getSelectedDepartmentPrograms();
    if (!programs.some((program) => courseMatchesDepartmentProgram(course, program))) return false;
  }
  if (filters.hideSaved && isSaved(course.code)) return false;
  return true;
}

function getSearchScore(course, needle) {
  if (!needle) return 0;
  const code = normalizeSearchText(course.code);
  const name = normalizeSearchText(course.name);
  if (code === needle) return 100;
  if (name === needle) return 95;
  if (code.startsWith(needle)) return 90;
  if (name.startsWith(needle)) return 80;
  if (code.includes(needle)) return 70;
  if (name.includes(needle)) return 60;
  return 10;
}

function searchCourses(query) {
  const needle = normalizeSearchText(query);
  if (!needle && !hasActiveSearchFilters()) return [];

  return state.courses
    .filter((course) => {
      if (!courseMatchesFilters(course)) return false;
      if (!needle) return true;
      const haystack = [
        course.code,
        course.name,
        course.liberalCategoryName,
        course.liberalDetail,
        course.liberalDetailName,
        course.hostDepartment,
        ...(course.departments || []),
        ...(course.majorDepartments || []),
        ...(course.classTypes || []),
      ].map(normalizeSearchText).join(" ");
      return haystack.includes(needle);
    })
    .sort((a, b) =>
      getSearchScore(b, needle) - getSearchScore(a, needle)
        || a.code.localeCompare(b.code),
    );
}

function courseRow(course, { saved = false } = {}) {
  const row = document.createElement("article");
  row.className = `course-row${saved ? " saved" : ""}`;

  const info = document.createElement("div");
  const title = document.createElement("div");
  title.className = "course-title";
  title.innerHTML = `<span class="course-code">${course.customCredit ? "직접입력" : course.code}</span><strong>${course.name}</strong>`;

  const meta = document.createElement("div");
  meta.className = "course-meta";
  meta.innerHTML = `
    <span>${formatCredits(course.credits)}학점</span>
    <span>${getCourseType(course)}</span>
  `;

  const tags = document.createElement("div");
  tags.className = "course-meta";
  renderCourseTags(tags, course);

  info.append(title, meta, tags);

  if (saved && canRecognizeAsMajor(course)) {
    const recognition = document.createElement("label");
    recognition.className = "recognition-toggle";
    recognition.innerHTML = `
      <input type="checkbox" ${course.majorRecognized ? "checked" : ""} />
      <span>전공 인정</span>
    `;
    recognition.querySelector("input").addEventListener("change", (event) => {
      toggleMajorRecognition(course.code, event.target.checked);
    });
    info.append(recognition);
  }

  const minorTargets = saved ? getMinorRecognitionTargets(course) : [];
  if (minorTargets.length) {
    const minorRecognition = document.createElement("div");
    minorRecognition.className = "minor-recognition";
    const options = [
      `<label>
        <input type="radio" name="minor-recognition-${course.code}" value="" ${!getActiveMinorRecognitionProgram(course) ? "checked" : ""} />
        <span>AI전공 학점 유지</span>
      </label>`,
      ...minorTargets.map((program) => `
        <label>
          <input type="radio" name="minor-recognition-${course.code}" value="${program.id}" ${course.minorRecognizedFor === program.id ? "checked" : ""} />
          <span>${getMinorProgramLabel(program)} 부전공 인정</span>
        </label>
      `),
    ].join("");
    minorRecognition.innerHTML = `
      <div class="recognition-caption">겹치는 전공 학점 귀속</div>
      <div class="minor-recognition-options">${options}</div>
    `;
    minorRecognition.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", (event) => {
        setMinorRecognition(course.code, event.target.value);
      });
    });
    info.append(minorRecognition);
  }

  const doubleMajorTargets = saved ? getDoubleMajorRecognitionTargets(course) : [];
  if (doubleMajorTargets.length) {
    const doubleMajorRecognition = document.createElement("div");
    doubleMajorRecognition.className = "minor-recognition";
    const options = [
      `<label>
        <input type="radio" name="double-major-recognition-${course.code}" value="" ${!getActiveDoubleMajorRecognitionProgram(course) ? "checked" : ""} />
        <span>AI전공 학점 유지</span>
      </label>`,
      ...doubleMajorTargets.map((program) => `
        <label>
          <input type="radio" name="double-major-recognition-${course.code}" value="${program.id}" ${course.doubleMajorRecognizedFor === program.id ? "checked" : ""} />
          <span>${getMinorProgramLabel(program)} 복수전공 인정</span>
        </label>
      `),
    ].join("");
    doubleMajorRecognition.innerHTML = `
      <div class="recognition-caption">겹치는 전공 학점 귀속</div>
      <div class="minor-recognition-options">${options}</div>
    `;
    doubleMajorRecognition.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", (event) => {
        setDoubleMajorRecognition(course.code, event.target.value);
      });
    });
    info.append(doubleMajorRecognition);
  }

  const convergenceMajorTargets = saved ? getConvergenceMajorRecognitionTargets(course) : [];
  if (convergenceMajorTargets.length) {
    const convergenceMajorRecognition = document.createElement("div");
    convergenceMajorRecognition.className = "minor-recognition";
    const options = [
      `<label>
        <input type="radio" name="convergence-major-recognition-${course.code}" value="" ${!getActiveConvergenceMajorRecognitionProgram(course) ? "checked" : ""} />
        <span>AI전공 학점 유지</span>
      </label>`,
      ...convergenceMajorTargets.map((program) => `
        <label>
          <input type="radio" name="convergence-major-recognition-${course.code}" value="${program.id}" ${course.convergenceMajorRecognizedFor === program.id ? "checked" : ""} />
          <span>${getMinorProgramLabel(program)} 인정</span>
        </label>
      `),
    ].join("");
    convergenceMajorRecognition.innerHTML = `
      <div class="recognition-caption">겹치는 전공 학점 귀속</div>
      <div class="minor-recognition-options">${options}</div>
    `;
    convergenceMajorRecognition.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", (event) => {
        setConvergenceMajorRecognition(course.code, event.target.value);
      });
    });
    info.append(convergenceMajorRecognition);
  }

  if (saved) {
    const remove = document.createElement("button");
    remove.className = "icon-button danger";
    remove.type = "button";
    remove.title = "삭제";
    remove.setAttribute("aria-label", `${course.name} 삭제`);
    remove.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    `;
    remove.addEventListener("click", () => removeCourse(course.code));
    row.append(info, remove);
    return row;
  }

  const add = document.createElement("button");
  add.className = "add-button";
  add.type = "button";
  add.textContent = isSaved(course.code) ? "저장됨" : "추가";
  add.disabled = isSaved(course.code);
  add.addEventListener("click", () => addCourse(course.code));
  row.append(info, add);
  return row;
}

function renderResults() {
  syncSearchFilterControls();
  const results = searchCourses(state.query);
  const visibleResults = results.slice(0, 80);
  els.resultList.replaceChildren();
  els.resultSummary.textContent = "";

  if (!state.query.trim() && !hasActiveSearchFilters()) {
    return;
  }

  if (!state.courses.length) {
    els.resultList.innerHTML = `<div class="empty-state">강의 DB를 불러오지 못했습니다.</div>`;
    return;
  }

  if (!results.length) {
    els.resultList.innerHTML = `<div class="empty-state">검색 결과가 없습니다.</div>`;
    return;
  }

  els.resultSummary.textContent = results.length > visibleResults.length
    ? `${results.length.toLocaleString()}개 중 상위 ${visibleResults.length}개 표시`
    : `${results.length.toLocaleString()}개 과목`;

  visibleResults.forEach((course) => els.resultList.append(courseRow(course)));
}

function renderSaved() {
  els.savedList.replaceChildren();

  const totalCredits = state.saved.reduce((sum, course) => sum + Number(course.credits || 0), 0);
  els.savedCount.textContent = `${state.saved.length}개`;
  els.savedCredits.textContent = `${formatCredits(totalCredits)}학점`;

  if (!state.saved.length) {
    els.savedList.innerHTML = `<div class="empty-state">저장된 과목이 없습니다.</div>`;
    return;
  }

  const savedGroups = [
    { key: "major", title: "전공" },
    ...(state.programType === "minor" ? [{ key: "minor", title: "부전공" }] : []),
    ...(state.programType === "doubleMajor" ? [{ key: "doubleMajor", title: "복수전공" }] : []),
    ...(state.programType === "convergenceMajor" ? [{ key: "convergence", title: "융합전공" }] : []),
    { key: "liberal", title: "교양" },
    { key: "general", title: "일반선택" },
  ];
  const groups = savedGroups.map((group) => ({
    ...group,
    courses: state.saved.filter((course) => getSavedCategory(course) === group.key),
  }));

  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "saved-group";
    const credits = group.courses.reduce((sum, course) => sum + Number(course.credits || 0), 0);
    section.innerHTML = `
      <div class="saved-group-head">
        <h3>${group.title}</h3>
        <span>${group.courses.length}개 · ${formatCredits(credits)}학점</span>
      </div>
    `;
    const list = document.createElement("div");
    list.className = "saved-group-list";
    if (!group.courses.length) {
      list.innerHTML = `<div class="empty-state">해당 과목이 없습니다.</div>`;
    } else {
      group.courses.forEach((course) => list.append(courseRow(course, { saved: true })));
    }
    section.append(list);
    els.savedList.append(section);
  });
}

function animateRequirementProgress(container = els.requirementsList) {
  const animatedItems = container.querySelectorAll("[data-target-progress]");
  requestAnimationFrame(() => {
    animatedItems.forEach((item) => {
      item.style.setProperty("--progress", `${item.dataset.targetProgress}%`);
    });
  });
}

function requirementIcon(label) {
  if (label.includes("총 졸업")) return "🎓";
  if (label.includes("전공필수")) return "🔖";
  if (label.includes("전공학점")) return "📖";
  if (label.includes("교양")) return "🏛️";
  if (label.includes("첨성인기초")) return "📚";
  if (label.includes("첨성인핵심")) return "⭐";
  if (label.includes("남은")) return "🔄";
  if (label.includes("실용영어")) return "🔤";
  if (label.includes("부전공")) return "🧩";
  if (label.includes("복수전공")) return "➕";
  if (label.includes("융합전공")) return "🔗";
  return "✓";
}

function progressCard(item) {
  const isInformational = item.required <= 0;
  const ratio = item.children.length
    ? item.children.filter((child) => child.complete).length / item.children.length
    : isInformational ? (item.current > 0 ? 1 : 0) : Math.min(item.current / item.required, 1);
  const percent = Math.round(ratio * 100);
  const card = document.createElement("article");
  card.className = `requirement-card ${isInformational ? "info" : item.complete ? "done" : "warn"}`;
  if (item.label === "총 졸업학점") {
    card.classList.add("main-requirement");
  }
  if (item.label === "실용영어") {
    card.classList.add("english-requirement");
  }
  if (item.label === "SDG교양") {
    card.classList.add("sdg-requirement");
  }
  const amount = isInformational
    ? `${formatCredits(item.current)}학점`
    : item.children.length && item.complete && item.current < item.required
      ? `${formatCredits(item.current)} / ${formatCredits(item.required)} + 면제`
    : `${formatCredits(item.current)} / ${formatCredits(item.required)}`;
  if (item.label === "총 졸업학점") {
    card.innerHTML = `
      <div class="requirement-icon" aria-hidden="true">${requirementIcon(item.label)}</div>
      <div class="requirement-copy">
        <div class="requirement-head">
          <strong>${item.label}</strong>
          <span>${amount}</span>
        </div>
        <div class="requirement-meta">${item.detail}</div>
        <div class="total-progress-bar" aria-label="총 졸업학점 진행률">
          <div class="total-progress-fill" data-target-progress="${percent}" style="--progress: 0%"></div>
        </div>
        <div class="total-progress-meta">
          <span>${percent}% 완료</span>
          <span>남은 ${formatCredits(Math.max(item.required - item.current, 0))}학점</span>
        </div>
      </div>
    `;
  } else {
    card.innerHTML = `
      <div class="requirement-icon" aria-hidden="true">${requirementIcon(item.label)}</div>
      <div class="circle-progress" data-target-progress="${percent}" style="--progress: 0%">
        <span>${isInformational ? formatCredits(item.current) : `${percent}%`}</span>
      </div>
      <div class="requirement-copy">
        <div class="requirement-head">
          <strong>${item.label}</strong>
          <span>${amount}</span>
        </div>
        <div class="requirement-meta">${item.detail}</div>
      </div>
    `;
  }
  if (item.children.length) {
    card.classList.add("with-children");
    const childList = document.createElement("div");
    childList.className = "requirement-sublist";
    item.children.forEach((child) => {
      const childRatio = child.required > 0 ? Math.min(child.current / child.required, 1) : 0;
      const childAmount = child.exempt
        ? "면제"
        : `${formatCredits(child.current)} / ${formatCredits(child.required)}`;
      const row = document.createElement("div");
      row.className = `requirement-subitem ${child.complete ? "done" : "warn"}`;
      row.innerHTML = `
        <div class="subitem-head">
          <span>${child.label}</span>
          <strong>${childAmount}</strong>
        </div>
        <div class="subitem-track">
          <div class="subitem-fill" data-target-progress="${Math.round(childRatio * 100)}" style="--progress: 0%"></div>
        </div>
      `;
      childList.append(row);
    });
    card.append(childList);
  } else if (item.label === "실용영어") {
    const englishNotes = document.createElement("div");
    englishNotes.className = "requirement-sublist english-sublist";
    englishNotes.innerHTML = `
      <div class="requirement-subitem ${item.complete ? "done" : "warn"}">
        <div class="subitem-head">
          <span>실용영어 분류 교과목</span>
          <strong>${formatCredits(item.current)} / ${formatCredits(item.required)}</strong>
        </div>
      </div>
      <div class="requirement-subitem ${item.complete ? "done" : "warn"}">
        <div class="subitem-head">
          <span>공인영어성적 등 대체기준</span>
          <strong>${state.specialOptions.practicalEnglishExamPassed ? "충족" : "필요 시"}</strong>
        </div>
      </div>
    `;
    card.append(englishNotes);
  } else if (item.label === "SDG교양") {
    const sdgNotes = document.createElement("div");
    sdgNotes.className = "requirement-sublist sdg-sublist";
    sdgNotes.innerHTML = `
      <div class="requirement-subitem ${item.complete ? "done" : "warn"}">
        <div class="subitem-head">
          <span>SDG 지정 교양 교과목</span>
          <strong>${formatCredits(item.current)} / ${formatCredits(item.required)}</strong>
        </div>
      </div>
      <div class="requirement-subitem ${item.complete ? "done" : "warn"}">
        <div class="subitem-head">
          <span>2024학번 이후 적용</span>
          <strong>${item.complete ? "충족" : "확인"}</strong>
        </div>
      </div>
    `;
    card.append(sdgNotes);
  }
  return card;
}

function findRequirementRow(rows, label) {
  return rows.find((item) => item.label === label) || null;
}

function makeTrackRequirement(row, title, detail) {
  return {
    ...row,
    label: title,
    detail: detail || row.detail,
  };
}

function createCollapsibleStatusSection(key, icon, title, description) {
  const section = document.createElement("section");
  section.className = "status-section";
  section.dataset.sectionKey = key;
  const collapsed = Boolean(state.collapsedStatusSections[key]);
  section.classList.toggle("is-collapsed", collapsed);
  section.innerHTML = `
    <div class="status-section-head">
      <span aria-hidden="true">${icon}</span>
      <strong>${title}</strong>
      <small>${description}</small>
      <button class="status-section-toggle" type="button" aria-expanded="${String(!collapsed)}">
        <span class="status-toggle-label">${collapsed ? "펼치기" : "접기"}</span>
        <svg class="status-toggle-icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>
    </div>
  `;
  section.querySelector(".status-section-toggle")?.addEventListener("click", () => {
    const nextCollapsed = !section.classList.contains("is-collapsed");
    state.collapsedStatusSections[key] = nextCollapsed;
    section.classList.toggle("is-collapsed", nextCollapsed);
    const button = section.querySelector(".status-section-toggle");
    const label = section.querySelector(".status-toggle-label");
    button?.setAttribute("aria-expanded", String(!nextCollapsed));
    if (label) label.textContent = nextCollapsed ? "펼치기" : "접기";
  });
  return section;
}

function appendCollapsibleStatusBody(section, content) {
  const body = document.createElement("div");
  body.className = "collapsible-status-body";
  const inner = document.createElement("div");
  inner.className = "collapsible-status-inner";
  inner.append(content);
  body.append(inner);
  section.append(body);
}

function renderRequirementDashboard(status) {
  const rows = status.rows;
  const totalRow = findRequirementRow(rows, "총 졸업학점");
  const majorRow = findRequirementRow(rows, "전공학점");
  const liberalRow = findRequirementRow(rows, "교양학점");
  const requiredRow = findRequirementRow(rows, "전공필수");
  const flexibleRow = findRequirementRow(rows, "남은 학점");
  const englishRow = findRequirementRow(rows, "실용영어");
  const sdgRow = findRequirementRow(rows, "SDG교양");
  const basicRow = findRequirementRow(rows, "첨성인기초");
  const coreRow = findRequirementRow(rows, "첨성인핵심");
  const trackRows = rows.filter((item) =>
    item.label.includes("부전공") || item.label.includes("복수전공") || item.label.includes("융합전공"),
  );

  const dashboard = document.createElement("div");
  dashboard.className = "status-dashboard";

  const topGrid = document.createElement("div");
  topGrid.className = "status-top-grid";
  if (totalRow) topGrid.append(progressCard(totalRow));

  const primaryDeck = document.createElement("div");
  primaryDeck.className = "status-primary-deck";
  const primaryRows = [majorRow, liberalRow, requiredRow, flexibleRow].filter(Boolean);
  primaryDeck.style.setProperty("--primary-count", String(primaryRows.length));
  primaryRows.forEach((item) => {
    const card = progressCard(item);
    card.classList.add("primary-requirement");
    primaryDeck.append(card);
  });
  topGrid.append(primaryDeck);
  dashboard.append(topGrid);

  const supportRows = [].filter(Boolean);
  if (supportRows.length) {
    const supportDeck = document.createElement("div");
    supportDeck.className = "status-support-deck";
    supportRows.forEach((item) => {
      const card = progressCard(item);
      card.classList.add("support-requirement");
      supportDeck.append(card);
    });
    dashboard.append(supportDeck);
  }

  const trackPanel = createCollapsibleStatusSection(
    "majorTrack",
    "📁",
    "전공 세부요건",
    "주전공과 선택한 다전공 학점 현황입니다.",
  );
  trackPanel.classList.add("major-track-section");
  const trackGrid = document.createElement("div");
  trackGrid.className = "major-track-grid";
  if (majorRow) {
    const card = progressCard(makeTrackRequirement(majorRow, "주전공", "전자공학부 인공지능전공 전공학점"));
    card.classList.add("track-requirement", "home-track");
    trackGrid.append(card);
  }
  trackRows.forEach((item) => {
    const card = progressCard(item);
    card.classList.add("track-requirement");
    trackGrid.append(card);
  });
  if (!trackRows.length) {
    const note = document.createElement("article");
    note.className = "track-note-card";
    note.innerHTML = `
      <div class="track-note-icon" aria-hidden="true">AI</div>
      <div>
        <strong>단일전공 기준</strong>
        <p>현재 선택에서는 전자공학부 인공지능전공 전공학점만 전공 영역으로 계산합니다.</p>
        <p>부전공, 복수전공, 융합전공을 선택하면 이 영역에 추가 전공 카드가 함께 표시됩니다.</p>
      </div>
    `;
    trackGrid.append(note);
  }
  appendCollapsibleStatusBody(trackPanel, trackGrid);
  dashboard.append(trackPanel);

  const liberalRows = [basicRow, coreRow, englishRow, sdgRow].filter(Boolean);
  if (liberalRows.length) {
    const liberalPanel = createCollapsibleStatusSection(
      "liberal",
      "🏛️",
      "교양 세부요건",
      "첨성인과 실용영어 조건을 확인하세요.",
    );
    liberalPanel.classList.add("liberal-status-section");
    const liberalGrid = document.createElement("div");
    liberalGrid.className = "status-detail-grid";
    liberalGrid.style.setProperty("--detail-count", String(liberalRows.length));
    liberalRows.forEach((item) => {
      const card = progressCard(item);
      card.classList.add("detail-requirement");
      liberalGrid.append(card);
    });
    appendCollapsibleStatusBody(liberalPanel, liberalGrid);
    dashboard.append(liberalPanel);
  }

  els.requirementsList.append(dashboard);
}

function optionToggle(key, title, description) {
  const label = document.createElement("label");
  label.className = "option-toggle";
  label.innerHTML = `
    <input type="checkbox" ${state.specialOptions[key] ? "checked" : ""} />
    <span>
      <strong>${title}</strong>
      <small>${description}</small>
    </span>
  `;
  label.querySelector("input").addEventListener("change", (event) => {
    state.specialOptions = {
      ...state.specialOptions,
      [key]: event.target.checked,
    };
    persistSpecialOptions();
    renderRequirements();
  });
  return label;
}

function renderSpecialOptions() {
  els.specialOptions.replaceChildren();
  els.specialOptions.append(
    optionToggle(
      "diagnosticMathScienceExempt",
      "진단평가 A",
      "첨성인기초 ‘수리’, ‘기초과학’ 중 3학점 이수 면제. 학점 인정은 아님.",
    ),
    optionToggle(
      "practicalEnglishExamPassed",
      "실용영어 대체성적 취득",
      "실용영어 분류 교과목 4학점 이수 없이 대체기준으로 충족.",
    ),
  );
}

function renderRequirements() {
  renderSegmentedControls();
  els.requirementsList.replaceChildren();
  els.missingRequiredList.replaceChildren();
  els.specialOptions.replaceChildren();
  els.admissionYearInput.value = state.admissionYear;
  els.programNotice.hidden = false;

  if (!state.requirements) {
    els.programNotice.innerHTML = `<div class="summary-title">졸업요건을 불러오는 중입니다.</div>`;
    return;
  }

  if (!isSupportedAdmissionYear()) {
    const years = getSupportedYears().join(", ");
    els.programNotice.innerHTML = `<div class="summary-title">${state.admissionYear || "입력한"}학번은 아직 지원하지 않습니다.</div><div class="summary-grid"><span>현재 지원 학번: ${years}</span></div>`;
    els.requirementsList.innerHTML = `<div class="empty-state">지원되는 학번을 입력하면 졸업요건 계산이 표시됩니다.</div>`;
    els.missingRequiredList.innerHTML = `<div class="empty-state">학번을 먼저 확인하세요.</div>`;
    return;
  }

  if (!["singleMajor", "minor", "doubleMajor", "convergenceMajor"].includes(state.programType)) {
    els.programNotice.innerHTML = `<div class="summary-title">현재 계산은 단일전공, 복수전공, 부전공, 융합전공을 지원합니다.</div>`;
    els.requirementsList.innerHTML = `<div class="empty-state">이수 형태를 선택하면 졸업요건 계산이 표시됩니다.</div>`;
    return;
  }

  const req = getRequirementSet();
  const status = calculateGraduationStatus();
  if (!req || !status) {
    els.programNotice.textContent = "선택한 학번의 졸업요건이 아직 없습니다.";
    return;
  }

  els.programNotice.innerHTML = "";
  els.programNotice.hidden = true;

  renderRequirementDashboard(status);
  animateRequirementProgress();
  renderSpecialOptions();

  if (!status.missingRequired.length) {
    els.missingRequiredList.innerHTML = `<div class="empty-state">전공필수를 모두 선택했습니다.</div>`;
    return;
  }

  const list = document.createElement("div");
  list.className = "missing-list";
  status.missingRequired.forEach((course) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = `${course.name} (${course.code})`;
    list.append(pill);
  });
  els.missingRequiredList.append(list);
}

function render() {
  renderMinorConfig();
  renderResults();
  renderSaved();
  renderRequirements();
}

function addCourse(code) {
  const course = state.courses.find((item) => item.code === code);
  if (!course || isSaved(code)) return;
  state.saved = [...state.saved, { ...course, majorRecognized: false, minorRecognizedFor: "", doubleMajorRecognizedFor: "", convergenceMajorRecognizedFor: "" }].sort((a, b) =>
    a.code.localeCompare(b.code),
  );
  persistSaved();
  render();
}

function addCustomCredit({ title, credits, category }) {
  const safeTitle = String(title || "").trim();
  const safeCredits = Number(credits);
  const safeCategory = ["major", "liberal", "general"].includes(category) ? category : "general";
  if (!safeTitle) {
    window.alert("외부 인정 학점 제목을 입력해 주세요.");
    return false;
  }
  if (!Number.isFinite(safeCredits) || safeCredits < 0) {
    window.alert("인정 학점은 숫자로 입력해 주세요.");
    return false;
  }

  const course = {
    code: `EXT-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    name: safeTitle,
    credits: safeCredits,
    customCredit: true,
    customCategory: safeCategory,
    flags: {
      major: safeCategory === "major",
      liberalArts: safeCategory === "liberal",
      majorRequired: false,
      generalElective: safeCategory === "general",
      sdg: false,
    },
    classTypes: ["직접입력"],
    departments: [],
    majorDepartments: [],
    majorRecognized: false,
    minorRecognizedFor: "",
    doubleMajorRecognizedFor: "",
    convergenceMajorRecognizedFor: "",
  };

  state.saved = [...state.saved, course].sort((a, b) => a.code.localeCompare(b.code));
  persistSaved();
  render();
  return true;
}

function removeCourse(code) {
  state.saved = state.saved.filter((course) => course.code !== code);
  persistSaved();
  render();
}

function toggleMajorRecognition(code, recognized) {
  state.saved = state.saved.map((course) =>
    course.code === code
      ? {
          ...course,
          majorRecognized: recognized,
          minorRecognizedFor: recognized ? "" : course.minorRecognizedFor,
          doubleMajorRecognizedFor: recognized ? "" : course.doubleMajorRecognizedFor,
          convergenceMajorRecognizedFor: recognized ? "" : course.convergenceMajorRecognizedFor,
        }
      : course,
  );
  persistSaved();
  render();
}

function setMinorRecognition(code, minorProgramId) {
  state.saved = state.saved.map((course) =>
    course.code === code
      ? {
          ...course,
          minorRecognizedFor: minorProgramId,
          doubleMajorRecognizedFor: minorProgramId ? "" : course.doubleMajorRecognizedFor,
          convergenceMajorRecognizedFor: minorProgramId ? "" : course.convergenceMajorRecognizedFor,
          majorRecognized: minorProgramId ? false : course.majorRecognized,
        }
      : course,
  );
  persistSaved();
  render();
}

function setDoubleMajorRecognition(code, doubleMajorProgramId) {
  state.saved = state.saved.map((course) =>
    course.code === code
      ? {
          ...course,
          doubleMajorRecognizedFor: doubleMajorProgramId,
          minorRecognizedFor: doubleMajorProgramId ? "" : course.minorRecognizedFor,
          convergenceMajorRecognizedFor: doubleMajorProgramId ? "" : course.convergenceMajorRecognizedFor,
          majorRecognized: doubleMajorProgramId ? false : course.majorRecognized,
        }
      : course,
  );
  persistSaved();
  render();
}

function setConvergenceMajorRecognition(code, convergenceMajorProgramId) {
  state.saved = state.saved.map((course) =>
    course.code === code
      ? {
          ...course,
          convergenceMajorRecognizedFor: convergenceMajorProgramId,
          minorRecognizedFor: convergenceMajorProgramId ? "" : course.minorRecognizedFor,
          doubleMajorRecognizedFor: convergenceMajorProgramId ? "" : course.doubleMajorRecognizedFor,
          majorRecognized: convergenceMajorProgramId ? false : course.majorRecognized,
        }
      : course,
  );
  persistSaved();
  render();
}

function hydrateSavedCourses() {
  const savedByCode = new Map(state.saved.map((course) => [course.code, course]));
  state.saved = [...savedByCode.values()]
    .map((savedCourse) => {
      const current = state.courses.find((course) => course.code === savedCourse.code);
      if (!current) return savedCourse;
      return {
        ...current,
        majorRecognized: Boolean(savedCourse.majorRecognized),
        minorRecognizedFor: savedCourse.minorRecognizedFor || "",
        doubleMajorRecognizedFor: savedCourse.doubleMajorRecognizedFor || "",
        convergenceMajorRecognizedFor: savedCourse.convergenceMajorRecognizedFor || "",
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
  persistSaved();
}

async function boot() {
  loadSaved();
  renderSaved();

  try {
    const [courseResponse, requirementsResponse, minorProgramsResponse, doubleMajorProgramsResponse, convergenceMajorProgramsResponse] = await Promise.all([
      fetch(COURSE_JSON_PATH),
      fetch(REQUIREMENTS_JSON_PATH),
      fetch(MINOR_PROGRAMS_JSON_PATH),
      fetch(DOUBLE_MAJOR_PROGRAMS_JSON_PATH),
      fetch(CONVERGENCE_MAJOR_PROGRAMS_JSON_PATH),
    ]);
    if (!courseResponse.ok) throw new Error(`HTTP ${courseResponse.status}`);
    if (!requirementsResponse.ok) throw new Error(`HTTP ${requirementsResponse.status}`);
    if (!minorProgramsResponse.ok) throw new Error(`HTTP ${minorProgramsResponse.status}`);
    if (!doubleMajorProgramsResponse.ok) throw new Error(`HTTP ${doubleMajorProgramsResponse.status}`);
    if (!convergenceMajorProgramsResponse.ok) throw new Error(`HTTP ${convergenceMajorProgramsResponse.status}`);
    const payload = await courseResponse.json();
    state.requirements = await requirementsResponse.json();
    const minorPayload = await minorProgramsResponse.json();
    const doubleMajorPayload = await doubleMajorProgramsResponse.json();
    const convergenceMajorPayload = await convergenceMajorProgramsResponse.json();
    state.minorPrograms = minorPayload.programs || [];
    state.doubleMajorPrograms = doubleMajorPayload.programs || [];
    state.convergenceMajorPrograms = convergenceMajorPayload.programs || [];
    state.courses = mergeConvergenceCoursesIntoCourseDb(payload.courses || [], state.convergenceMajorPrograms);
    hydrateSavedCourses();
    const addedConvergenceCourses = state.courses.length - (payload.courses || []).length;
    if (els.dbSummary) {
      els.dbSummary.textContent = addedConvergenceCourses > 0
        ? `${payload.metadata.courseCount.toLocaleString()}개 과목 + 융합전공 ${addedConvergenceCourses}개 보강`
        : `${payload.metadata.courseCount.toLocaleString()}개 과목을 불러왔습니다.`;
    }
    render();
  } catch (error) {
    if (els.dbSummary) els.dbSummary.textContent = "강의 DB를 불러오지 못했습니다.";
    renderResults();
  }
}

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderResults();
});

els.courseTypeFilter.addEventListener("change", (event) => {
  state.searchFilters.type = event.target.value;
  if (state.searchFilters.type !== "liberal") {
    state.searchFilters.liberalCategory = "";
  }
  if (!["", "aiMajor", "otherMajor"].includes(state.searchFilters.type)) {
    state.searchFilters.college = "";
    state.searchFilters.school = "";
    state.searchFilters.major = "";
  }
  renderResults();
});

els.liberalCategoryFilter.addEventListener("change", (event) => {
  state.searchFilters.liberalCategory = event.target.value;
  renderResults();
});

els.collegeFilter.addEventListener("change", (event) => {
  state.searchFilters.college = event.target.value;
  state.searchFilters.school = "";
  state.searchFilters.major = "";
  renderResults();
});

els.schoolFilter.addEventListener("change", (event) => {
  state.searchFilters.school = event.target.value;
  state.searchFilters.major = "";
  renderResults();
});

els.majorFilter.addEventListener("change", (event) => {
  state.searchFilters.major = event.target.value;
  renderResults();
});

els.hideSavedFilter.addEventListener("change", (event) => {
  state.searchFilters.hideSaved = event.target.checked;
  renderResults();
});

els.resetSearchFilters.addEventListener("click", () => {
  state.query = "";
  state.searchFilters = { ...DEFAULT_SEARCH_FILTERS };
  els.search.value = "";
  renderResults();
});

els.admissionYearInput.addEventListener("input", (event) => {
  state.admissionYear = event.target.value.trim();
  localStorage.setItem(ADMISSION_YEAR_KEY, state.admissionYear);
  renderRequirements();
});

els.programTypeGroup.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-program]");
  if (!button) return;
  if (button.disabled) return;
  state.programType = button.dataset.program;
  localStorage.setItem(PROGRAM_TYPE_KEY, state.programType);
  render();
});

els.clearSaved.addEventListener("click", () => {
  if (!state.saved.length) return;
  const confirmed = window.confirm("나의 수강 과목을 모두 삭제할까요?");
  if (!confirmed) return;
  state.saved = [];
  persistSaved();
  render();
});

els.customCreditForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const added = addCustomCredit({
    title: els.customCreditTitle?.value,
    credits: els.customCreditValue?.value,
    category: els.customCreditCategory?.value,
  });
  if (!added) return;
  els.customCreditForm.reset();
  if (els.customCreditCategory) els.customCreditCategory.value = "major";
  syncAnimatedSelect(els.customCreditCategory);
});


initInteractiveEyeCards();
initAnimatedSelects();
boot();
