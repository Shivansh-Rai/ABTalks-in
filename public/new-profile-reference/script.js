/* ============================================================
   AB TALKS — Student Profile / Profile Completion
   State, navigation, completion, progress, persistence.
   ============================================================ */
(function () {
  "use strict";

  var STORAGE_KEY = "studentProfile";

  /* ----------------------------------------------------------
     1. Section data architecture
     ---------------------------------------------------------- */
  var profileSections = [
    {
      id: "basic",
      title: "Basic Information",
      description: "This is how you are introduced on the platform.",
      completed: false,
      type: "single",
      fields: [
        { name: "firstName", label: "First name", required: true, placeholder: "Enter your first name", col: 4 },
        { name: "middleName", label: "Middle name", placeholder: "Enter your middle name (optional)", col: 4 },
        { name: "lastName", label: "Last name", required: true, placeholder: "Enter your last name", col: 4 },

        { name: "countryCode", label: "Country code", kind: "country", required: true,
          placeholder: "Select a country", renderedBy: "phone" },
        { name: "phone", label: "Phone", kind: "phone", codeName: "countryCode",
          required: true, placeholder: "Enter your phone number", codePlaceholder: "Code",
          col: 6, badge: "Verified", validate: "phone" },
        { name: "state", label: "State / region", kind: "select", col: 6, newRow: true,
          placeholder: "Select a state", dependsOn: "countryCode", optionsFrom: "states",
          emptyPlaceholder: "Select a country code first" },
        { name: "city", label: "City", kind: "select", col: 6,
          placeholder: "Select a city", dependsOn: "state", optionsFrom: "cities",
          emptyPlaceholder: "Select a state first", fallbackText: "Enter your city" },

        { name: "headline", label: "Headline", placeholder: "Enter a short headline", col: 12 },
        { name: "languages", label: "Languages", kind: "tags", col: 12, noAddButton: true,
          placeholder: "Add a language",
          quickAdds: ["English", "Hindi", "Marathi", "Tamil", "Telugu", "Bengali", "Spanish", "French"] },
        { name: "resume", label: "Resume", kind: "file", col: 12,
          accept: ".pdf,.doc,.docx", maxSizeMB: 5,
          hint: "PDF or DOCX, up to 5 MB \u2014 drop it here or browse." },

        { name: "about", label: "About", kind: "textarea", col: 12, counter: 2000, placeholder: "Tell recruiters who you are and what you are working towards" }
      ]
    },
    {
      id: "experience",
      title: "Experience",
      description: "Roles, Internships and freelance work.",
      completed: false,
      type: "repeat",
      entryLabel: "Role",
      addLabel: "+ Add More",
      fields: [
        { name: "company", label: "Company", required: true, placeholder: "Enter the company name", col: 6 },
        { name: "role", label: "Role", required: true, placeholder: "Enter your role", col: 6 },
        { name: "employmentType", label: "Employment type", kind: "select", col: 6,
          placeholder: "Select an employment type",
          options: ["Internship", "Full-time", "Part-time", "Freelance", "Contract", "Apprenticeship"] },
        { name: "location", label: "Location", placeholder: "Enter the location", col: 6 },
        { name: "current", label: "Currently working here", kind: "checkbox", col: 12 },
        { name: "start", label: "Starting from", kind: "monthyear", required: true, col: 6 },
        { name: "end", label: "Ending in", kind: "monthyear", required: true, col: 6, hideWhen: "current" },
        { name: "description", label: "Description", kind: "textarea", col: 12,
          placeholder: "What you owned, what you shipped, and the impact it had" }
      ]
    },
    {
      id: "education",
      title: "Education",
      description: "College, school, and any additional qualifications.",
      completed: false,
      type: "repeat",
      entryLabel: "Education",
      addLabel: "+ Add More",
      fields: [
        { name: "school", label: "School / College", required: true, placeholder: "Enter your school or college", col: 12 },
        { name: "degree", label: "Degree", kind: "select", col: 6,
          placeholder: "Select a degree", optionsFrom: "degrees" },
        { name: "department", label: "Specialization", kind: "select", col: 6,
          placeholder: "Select a specialization", dependsOn: "degree", optionsFrom: "specializations",
          emptyPlaceholder: "Select a degree first" },
        { name: "current", label: "Currently studying here", kind: "checkbox", col: 12 },
        { name: "start", label: "Starting from", kind: "monthyear", required: true, col: 6 },
        { name: "end", label: "Ending in", kind: "monthyear", required: true, col: 6, hideWhen: "current" },
        { name: "scoreType", label: "Score type", kind: "select", col: 6,
          placeholder: "Select a score type",
          options: ["CGPA_10", "CGPA_4", "PERCENTAGE", "GRADE"] },
        { name: "score", label: "Score", placeholder: "Enter your score", col: 6, validate: "score" },
        { name: "description", label: "Description", kind: "textarea", col: 12,
          placeholder: "Coursework, thesis, societies, or anything else worth knowing" }
      ]
    },
    {
      id: "projects",
      title: "Projects",
      description: "Things you have built, with links a recruiter can open.",
      completed: false,
      type: "repeat",
      entryLabel: "Project",
      addLabel: "+ Add More",
      fields: [
        { name: "name", label: "Project name", required: true, placeholder: "Enter the project name", col: 12 },
        { name: "description", label: "Description", kind: "textarea", col: 12,
          placeholder: "What it does, what was hard about it, and what you built yourself" },
        { name: "techStack", label: "Tech stack", kind: "tags", col: 12,
          placeholder: "Add a technology",
          quickAdds: ["React", "Next.js", "Node.js", "Postgres", "Python", "Figma", "Tailwind", "Firebase"],
          helper: "Descriptive only \u2014 this does not add to your skills." },
        { name: "github", label: "GitHub", type: "url", placeholder: "https://github.com/username/repo", col: 6, validate: "url" },
        { name: "liveUrl", label: "Live URL", type: "url", placeholder: "https://example.com", col: 6, validate: "url" }
      ]
    },
    {
      id: "mock",
      title: "Mock Interview",
      description: "Live AI interviews you have taken. Earned, not entered.",
      completed: false,
      type: "single",
      attention: true,
      fields: [
        { kind: "note", col: 12,
          text: "You haven\u2019t taken a mock interview yet. They are live voice interviews with an AI interviewer, and each one you finish keeps its own scored report." },
        { kind: "action", col: 12, label: "Take a mock interview", icon: "mic" }
      ]
    },
    {
      id: "skills",
      title: "Skills",
      description: "What you claim, kept separate from what the platform can verify.",
      completed: false,
      type: "single",
      fields: [
        { name: "skills", label: "Skills", kind: "tags", col: 12,
          placeholder: "Add a skill", noAddButton: true,
          helper: "Pick from the catalog so recruiters searching that skill can find you.",
          quickAdds: ["Python", "sql", "Java", "C++", "HTML", "CSS", "React", "JavaScript", "Excel", "js"] }
      ]
    },
    {
      id: "certifications",
      title: "Certifications",
      description: "External certifications you hold.",
      completed: false,
      type: "repeat",
      entryLabel: "Certification",
      addLabel: "+ Add More",
      intro: "External certifications only \u2014 AWS, Databricks, and the like. Anything ABTalks issued you already appears under Evidence & achievements.",
      fields: [
        { name: "name", label: "Name", required: true, placeholder: "Enter the certification name", col: 6 },
        { name: "issuer", label: "Issuer", required: true, placeholder: "Enter the issuing organisation", col: 6 },
        { name: "issued", label: "Issued", kind: "monthyear", col: 6 },
        { name: "expires", label: "Expires", kind: "monthyear", col: 6 },
        { name: "credentialUrl", label: "Credential URL", type: "url", col: 12,
          placeholder: "https://example.com/your-credential", validate: "url" }
      ]
    },
    {
      id: "links",
      title: "Links",
      description: "Where your work lives.",
      completed: false,
      type: "single",
      fields: [
        { name: "linkedin", label: "LinkedIn", type: "url", icon: "briefcase", col: 12, validate: "url",
          placeholder: "https://linkedin.com/in/username" },
        { name: "github", label: "GitHub", type: "url", icon: "code", col: 12, validate: "url",
          placeholder: "https://github.com/username",
          helper: "Username or full profile URL \u2014 both are stored as your username." },
        { name: "portfolio", label: "Portfolio", type: "url", icon: "globe", col: 12, validate: "url",
          placeholder: "https://yoursite.com" },
        { name: "resume", label: "R\u00e9sum\u00e9", type: "url", icon: "file", col: 12, validate: "url",
          placeholder: "https://drive.google.com/file/d/your-file",
          helper: "Visible to you and admins. Recruiters see it only if you allow it." }
      ]
    },
    {
      id: "career",
      title: "Career Preferences",
      description: "What you are looking for. Separate from recruiter visibility.",
      completed: false,
      type: "single",
      fields: [
        { name: "openToWork", kind: "toggle", col: 12,
          title: "Open to work",
          text: "Says whether you are looking right now. Separate from whether recruiters can find you at all \u2014 this switch does not change that." },
        { name: "preferredRoles", label: "Preferred roles", kind: "tags", col: 12, placeholder: "Add a role",
          quickAdds: ["Frontend Engineer", "Backend Engineer", "Product Designer", "Data Analyst", "Product Manager"] },
        { name: "preferredLocations", label: "Preferred locations", kind: "tags", col: 12, placeholder: "Add a location",
          quickAdds: ["Bangalore", "Delhi NCR", "Mumbai", "Hyderabad", "Pune", "Remote"] },
        { name: "opportunityType", label: "Opportunity type", kind: "checkgroup", col: 12,
          options: ["Internship", "Full-time", "Part-time", "Contract", "Freelance"] },
        { name: "workMode", label: "Work mode", kind: "select", col: 6,
          placeholder: "Select a work mode",
          options: ["On-site", "Hybrid", "Remote"] },
        { name: "noticePeriod", label: "Notice period", placeholder: "Enter notice period in days", col: 6, validate: "days",
          helper: "In days. Leave blank if you are immediately available." },
        { name: "availableFrom", label: "Available from", kind: "monthyear", col: 6 },
        { name: "willingToRelocate", label: "Willing to relocate", kind: "checkbox", col: 6, inline: true }
      ]
    },
    {
      id: "references",
      title: "References",
      description: "People who can vouch for your work.",
      completed: false,
      type: "repeat",
      attention: true,
      entryLabel: "Reference",
      addLabel: "+ Add More",
      fields: [
        { name: "name", label: "Full name", required: true, placeholder: "Enter their full name", col: 6 },
        { name: "relationship", label: "Relationship", placeholder: "Enter how you know them", col: 6 },
        { name: "email", label: "Email", type: "email", placeholder: "Enter their email address", col: 6, validate: "email" },
        { name: "phone", label: "Phone", type: "tel", placeholder: "Enter their phone number", col: 6, validate: "phone" },
        { name: "note", label: "Note", kind: "textarea", col: 12, placeholder: "Context for the recruiter" }
      ]
    }
  ];

  var TOTAL = profileSections.length;

  /* ----------------------------------------------------------
     2. State
     ---------------------------------------------------------- */
  var state = {
    currentSectionIndex: 0,
    completed: {},          // { sectionId: true }
    values: {},             // { sectionId: {..} | [{..},{..}] }
    celebrated: false,
    editing: false,         // current section is in EDIT mode
    reviewDirty: false      // legacy flag, kept so old saved state still loads
  };

  /* ----------------------------------------------------------
     3. DOM refs
     ---------------------------------------------------------- */
  var el = {
    checklist: document.getElementById("checklist"),
    body: document.getElementById("sectionBody"),
    title: document.getElementById("sectionTitle"),
    desc: document.getElementById("sectionDesc"),
    header: document.getElementById("sectionHeader"),
    progress: document.getElementById("sectionProgress"),
    ring: document.getElementById("ringFg"),
    ringWrap: document.querySelector(".ring-wrap"),
    ringCheck: document.getElementById("ringCheck"),
    pctNum: document.getElementById("pctNum"),
    pctBadge: document.getElementById("pctBadge"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    reviewBody: document.getElementById("reviewBody"),
    reviewPct: document.getElementById("reviewPct"),
    reviewSub: document.getElementById("reviewSub"),
    identityMedia: document.getElementById("identityMedia"),
    formSheet: document.getElementById("formSheet"),
    formScrim: document.getElementById("formScrim"),
    formClose: document.getElementById("formClose"),
    refillBtn: document.getElementById("refillBtn"),
    editBtn: document.getElementById("editBtn"),
    avatarEdit: document.getElementById("avatarEdit"),
    photoInput: document.getElementById("photoInput"),
    resetBtn: document.getElementById("resetBtn"),
    sidebar: document.getElementById("sidebar"),
    menuBtn: document.getElementById("mobileMenuBtn"),
    scrim: document.getElementById("scrim")
  };

  // ring geometry from Figma: 112 container, 100 track, r = 48.5
  var RING_CIRCUMFERENCE = 2 * Math.PI * 48.5;
  el.ring.style.strokeDasharray = RING_CIRCUMFERENCE;

  /* ----------------------------------------------------------
     4. Persistence
     ---------------------------------------------------------- */
  function saveState() {
    renderReview();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        currentSectionIndex: state.currentSectionIndex,
        completed: state.completed,
        values: state.values,
        celebrated: state.celebrated,
        reviewDirty: state.reviewDirty
      }));
    } catch (e) { /* storage unavailable — run in memory */ }
  }

  function loadState() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
    if (!raw) return;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return; }
    if (!parsed || typeof parsed !== "object") return;

    state.completed = parsed.completed && typeof parsed.completed === "object" ? parsed.completed : {};
    state.values = parsed.values && typeof parsed.values === "object" ? parsed.values : {};
    state.celebrated = !!parsed.celebrated;
    state.reviewDirty = !!parsed.reviewDirty;

    var idx = parseInt(parsed.currentSectionIndex, 10);
    state.currentSectionIndex = (isFinite(idx) && idx >= 0 && idx < TOTAL) ? idx : 0;

    profileSections.forEach(function (s) { s.completed = !!state.completed[s.id]; });
  }

  /* ----------------------------------------------------------
     5. Field rendering helpers
     ---------------------------------------------------------- */
  var MONTHS = ["1","2","3","4","5","6","7","8","9","10","11","12"];
  var YEARS = (function () {
    var out = [], y = new Date().getFullYear() + 6;
    for (var i = y; i >= 1975; i--) out.push(String(i));
    return out;
  })();

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fieldId(sectionId, entryIndex, name) {
    return "f_" + sectionId + "_" + entryIndex + "_" + name;
  }

  var ICONS = {
    mic: '<svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    pencil: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    code: '<svg viewBox="0 0 24 24"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>'
  };

  /* ----------------------------------------------------------
     5b. Country picker — ISO2 + dial code, names from Intl,
         flags from an image CDN with an emoji fallback.
     ---------------------------------------------------------- */
  var COUNTRY_CODES = "AF93,AX358,AL355,DZ213,AS1684,AD376,AO244,AI1264,AG1268,AR54,AM374,AW297,AU61,AT43,AZ994,BS1242,BH973,BD880,BB1246,BY375,BE32,BZ501,BJ229,BM1441,BT975,BO591,BA387,BW267,BR55,BN673,BG359,BF226,BI257,KH855,CM237,CA1,CV238,KY1345,CF236,TD235,CL56,CN86,CO57,KM269,CG242,CD243,CK682,CR506,CI225,HR385,CU53,CW599,CY357,CZ420,DK45,DJ253,DM1767,DO1809,EC593,EG20,SV503,GQ240,ER291,EE372,SZ268,ET251,FJ679,FI358,FR33,GF594,PF689,GA241,GM220,GE995,DE49,GH233,GI350,GR30,GL299,GD1473,GP590,GU1671,GT502,GG44,GN224,GW245,GY592,HT509,HN504,HK852,HU36,IS354,IN91,ID62,IR98,IQ964,IE353,IM44,IL972,IT39,JM1876,JP81,JE44,JO962,KZ7,KE254,KI686,KW965,KG996,LA856,LV371,LB961,LS266,LR231,LY218,LI423,LT370,LU352,MO853,MG261,MW265,MY60,MV960,ML223,MT356,MH692,MQ596,MR222,MU230,YT262,MX52,FM691,MD373,MC377,MN976,ME382,MS1664,MA212,MZ258,MM95,NA264,NR674,NP977,NL31,NC687,NZ64,NI505,NE227,NG234,NU683,NF672,KP850,MK389,MP1670,NO47,OM968,PK92,PW680,PS970,PA507,PG675,PY595,PE51,PH63,PL48,PT351,PR1787,QA974,RE262,RO40,RU7,RW250,BL590,SH290,KN1869,LC1758,MF590,PM508,VC1784,WS685,SM378,ST239,SA966,SN221,RS381,SC248,SL232,SG65,SX1721,SK421,SI386,SB677,SO252,ZA27,KR82,SS211,ES34,LK94,SD249,SR597,SJ47,SE46,CH41,SY963,TW886,TJ992,TZ255,TH66,TL670,TG228,TK690,TO676,TT1868,TN216,TR90,TM993,TC1649,TV688,UG256,UA380,GB44,US1,UY598,UZ998,VU678,VA39,VE58,VN84,VG1284,VI1340,WF681,EH212,YE967,ZM260,ZW263";

  var COUNTRIES = (function () {
    var namer = null;
    try { namer = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { /* older browser */ }
    return COUNTRY_CODES.split(",").map(function (tok) {
      var iso = tok.slice(0, 2);
      var dial = tok.slice(2);
      var name = iso;
      if (namer) { try { name = namer.of(iso) || iso; } catch (e) { name = iso; } }
      return { iso: iso, dial: dial, name: name };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  })();

  /* Flags are bundled as PNG data URIs (flags.js) so the picker works offline
     and does not depend on an emoji font — Windows has no flag glyphs. */
  function flagMarkup(iso) {
    var data = (window.AB_FLAGS || {})[iso];
    return data
      ? '<img class="flag" alt="" src="data:image/png;base64,' + data + '">'
      : '<span class="flag flag-iso">' + esc(iso) + "</span>";
  }

  function findCountry(iso) {
    for (var i = 0; i < COUNTRIES.length; i++) {
      if (COUNTRIES[i].iso === iso) return COUNTRIES[i];
    }
    return null;
  }

  /* ----------------------------------------------------------
     5c. One dropdown for the whole form — the country picker and every
         plain select share this menu, so they look and behave the same.
     ---------------------------------------------------------- */
  function openPicker(control, cfg) {
    if (control.disabled || control._menu) return;

    var menu = document.createElement("div");
    menu.className = "pick-menu";
    control._menu = menu;
    control.classList.add("open");

    var list = document.createElement("div");
    list.className = "pick-list";

    var search = null;
    if (cfg.search) {
      var wrapEl = document.createElement("div");
      wrapEl.className = "pick-search-wrap";
      wrapEl.innerHTML =
        '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>';
      search = document.createElement("input");
      search.type = "text";
      search.className = "pick-search";
      search.placeholder = cfg.searchPlaceholder || "Search";
      wrapEl.appendChild(search);
      menu.appendChild(wrapEl);
    }
    menu.appendChild(list);

    function render(q) {
      q = (q || "").trim().toLowerCase();
      list.innerHTML = "";
      var shown = cfg.items.filter(function (it) { return !q || cfg.match(it, q); });
      if (!shown.length) {
        list.innerHTML = '<div class="pick-empty">No match</div>';
        return;
      }
      shown.forEach(function (it) {
        var row = document.createElement("button");
        row.type = "button";
        row.className = "pick-row" + (cfg.isSelected(it) ? " selected" : "");
        row.innerHTML = cfg.renderRow(it);
        row.addEventListener("click", function () {
          cfg.onPick(it);
          close();
          control.focus();
        });
        list.appendChild(row);
      });
    }

    function close() {
      if (!control._menu) return;
      menu.remove();
      control._menu = null;
      control.classList.remove("open");
      document.removeEventListener("mousedown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    }
    control._close = close;

    function onOutside(e) {
      if (!menu.contains(e.target) && e.target !== control && !control.contains(e.target)) close();
    }
    function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); control.focus(); } }
    /* scrolling inside the menu must not dismiss it — only scrolling behind it */
    function onScroll(e) { if (menu === e.target || menu.contains(e.target)) return; close(); }

    render("");
    document.body.appendChild(menu);

    var r = control.getBoundingClientRect();
    var below = window.innerHeight - r.bottom - 16;
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 320)) + "px";
    menu.style.width = Math.max(r.width, cfg.minWidth || 220) + "px";
    if (below < 180 && r.top > 200) {
      menu.style.bottom = (window.innerHeight - r.top + 6) + "px";
      menu.style.maxHeight = Math.min(cfg.maxHeight || 320, r.top - 16) + "px";
    } else {
      menu.style.top = (r.bottom + 6) + "px";
      menu.style.maxHeight = Math.max(180, Math.min(cfg.maxHeight || 320, below)) + "px";
    }

    var sel = list.querySelector(".pick-row.selected");
    if (sel) list.scrollTop = sel.offsetTop - list.clientHeight / 2 + sel.offsetHeight / 2;

    if (search) {
      search.addEventListener("input", function () { render(search.value); });
      search.focus();
    }
    document.addEventListener("mousedown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
  }

  /* The country picker as a bare control, so it can stand alone in its own
     field or sit inside the combined phone control. `wrap` is the .field the
     error state belongs to. */
  function makeCountryControl(section, field, entryIndex, value, wrap) {
    var id = fieldId(section.id, entryIndex, field.name);
    var chosen = findCountry(String(value || "").toUpperCase());

    var control = document.createElement("button");
    control.type = "button";
    control.id = id;
    control.className = "pick-control country-control";
    control.dataset.name = field.name;
    control.dataset.kind = "country";
    control._value = chosen ? chosen.iso : "";

    function paint() {
      var c = findCountry(control._value);
      control.innerHTML = (c
        ? flagMarkup(c.iso) +
          '<span class="country-code">' + esc(c.iso) + "</span>" +
          '<span class="country-dial">+' + esc(c.dial) + "</span>"
        : '<span class="pick-ph">' + esc(field.placeholder || "Select") + "</span>") +
        '<svg class="pick-caret" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
    }

    control.addEventListener("click", function () {
      if (control._menu) { control._close(); return; }
      openPicker(control, {
        search: true,
        searchPlaceholder: "Search country or code",
        minWidth: 300,
        maxHeight: 340,
        items: COUNTRIES,
        match: function (c, q) {
          return c.name.toLowerCase().indexOf(q) > -1 ||
                 c.iso.toLowerCase().indexOf(q) > -1 ||
                 c.dial.indexOf(q.replace("+", "")) === 0;
        },
        isSelected: function (c) { return c.iso === control._value; },
        renderRow: function (c) {
          return flagMarkup(c.iso) +
            '<span class="pick-label">' + esc(c.name) + "</span>" +
            '<span class="country-dial">+' + esc(c.dial) + "</span>";
        },
        onPick: function (c) {
          control._value = c.iso;
          paint();
          clearFieldError(wrap, []);
          persistCurrentValues();
          control.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    });
    paint();
    return control;
  }

  function buildCountryField(section, field, entryIndex, value, wrap) {
    var id = fieldId(section.id, entryIndex, field.name);

    var top = document.createElement("div");
    top.className = "field-top";
    top.innerHTML = "<label for='" + id + "'>" + esc(field.label) +
      (field.required ? '<span class="req">*</span>' : "") + "</label>";
    wrap.appendChild(top);
    wrap.appendChild(makeCountryControl(section, field, entryIndex, value, wrap));

    if (field.helper) {
      var h2 = document.createElement("div");
      h2.className = "helper";
      h2.textContent = field.helper;
      wrap.appendChild(h2);
    }

    var err = document.createElement("div");
    err.className = "error-msg";
    err.textContent = "Choose a country.";
    wrap.appendChild(err);

    return wrap;
  }

  /* Country code + number as ONE control: the picker lives inside the phone
     field, separated by a hairline, and the whole box carries the border,
     focus ring and error state. Both halves keep their own data-name, so
     reading and persisting values is unchanged. */
  function buildPhoneField(section, field, entryIndex, value, wrap, values) {
    var id = fieldId(section.id, entryIndex, field.name);

    var top = document.createElement("div");
    top.className = "field-top";
    top.innerHTML = "<label for='" + id + "'>" + esc(field.label) +
      (field.required ? '<span class="req">*</span>' : "") + "</label>" +
      (field.badge ? '<span class="verified">' + esc(field.badge) + "</span>" : "");
    wrap.appendChild(top);

    var combo = document.createElement("div");
    combo.className = "phone-combo";

    var codeField = {
      name: field.codeName,
      label: field.label,
      placeholder: field.codePlaceholder || "Code",
      required: field.required
    };
    var code = makeCountryControl(
      section, codeField, entryIndex,
      values ? values[field.codeName] : "", wrap
    );
    combo.appendChild(code);

    var divider = document.createElement("span");
    divider.className = "phone-divider";
    combo.appendChild(divider);

    var input = document.createElement("input");
    input.type = "tel";
    input.id = id;
    input.className = "phone-number";
    input.dataset.name = field.name;
    input.placeholder = field.placeholder || "";
    input.value = value == null ? "" : value;
    combo.appendChild(input);

    // the whole box lights up when either half has focus
    function sync() { combo.classList.toggle("focused", combo.contains(document.activeElement)); }
    combo.addEventListener("focusin", sync);
    combo.addEventListener("focusout", function () { setTimeout(sync, 0); });

    input.addEventListener("input", function () { clearFieldError(wrap, [input]); });

    wrap.appendChild(combo);

    var err = document.createElement("div");
    err.className = "error-msg";
    wrap.appendChild(err);

    return wrap;
  }

  function formatBytes(n) {
    if (!n && n !== 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    return (n / 1024 / 1024).toFixed(1) + " MB";
  }

  /* Resume upload — click or drag-and-drop, with type and size checks.
     Only the file's name and size are persisted; the bytes stay in the page. */
  function buildFileField(section, field, entryIndex, value, wrap) {
    var saved = value && typeof value === "object" && value.name ? value : null;
    var id = fieldId(section.id, entryIndex, field.name);
    var maxBytes = (field.maxSizeMB || 5) * 1024 * 1024;

    var top = document.createElement("div");
    top.className = "field-top";
    top.innerHTML = "<label for='" + id + "'>" + esc(field.label) +
      (field.required ? '<span class="req">*</span>' : "") + "</label>";
    wrap.appendChild(top);

    var drop = document.createElement("div");
    drop.className = "file-drop";
    drop.dataset.name = field.name;
    drop.dataset.kind = "file";
    drop._file = saved;

    var input = document.createElement("input");
    input.type = "file";
    input.id = id;
    input.className = "file-input";
    if (field.accept) input.accept = field.accept;
    drop.appendChild(input);

    var body = document.createElement("div");
    body.className = "file-body";
    drop.appendChild(body);

    function renderEmpty() {
      drop.classList.remove("has-file");
      body.innerHTML =
        '<span class="file-icon">' + ICONS.upload + "</span>" +
        '<span class="file-copy">' +
          '<span class="file-title">Drop your resume here</span>' +
          '<span class="file-hint">' + esc(field.hint || "") + "</span>" +
        "</span>";
      var browse = document.createElement("button");
      browse.type = "button";
      browse.className = "file-browse";
      browse.textContent = "Browse files";
      browse.addEventListener("click", function () { input.click(); });
      body.appendChild(browse);
    }

    function renderFile(f) {
      drop.classList.add("has-file");
      var ext = (f.name.split(".").pop() || "file").toUpperCase();
      body.innerHTML =
        '<span class="file-icon file-icon-doc">' + ICONS.file +
          '<span class="file-ext">' + esc(ext.slice(0, 4)) + "</span>" +
        "</span>" +
        '<span class="file-copy">' +
          '<span class="file-title">' + esc(f.name) + "</span>" +
          '<span class="file-hint"><span class="file-ok">Uploaded</span>' +
            esc(formatBytes(f.size)) + "</span>" +
        "</span>";

      var replace = document.createElement("button");
      replace.type = "button";
      replace.className = "file-browse";
      replace.textContent = "Replace";
      replace.addEventListener("click", function () { input.click(); });
      body.appendChild(replace);

      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "file-remove";
      rm.setAttribute("aria-label", "Remove resume");
      rm.innerHTML = ICONS.close;
      rm.addEventListener("click", function () {
        drop._file = null;
        input.value = "";
        renderEmpty();
        persistCurrentValues();
      });
      body.appendChild(rm);
    }

    function showError(msg) {
      wrap.classList.add("has-error");
      var e = wrap.querySelector(".error-msg");
      if (e) e.textContent = msg;
    }

    function accept(fileList) {
      var f = fileList && fileList[0];
      if (!f) return;
      var okType = !field.accept || field.accept.split(",").some(function (ext) {
        return f.name.toLowerCase().endsWith(ext.trim().toLowerCase());
      });
      if (!okType) { showError("Use a PDF or DOCX file."); return; }
      if (f.size > maxBytes) {
        showError("That file is " + formatBytes(f.size) + ". The limit is " + field.maxSizeMB + " MB.");
        return;
      }
      clearFieldError(wrap, []);
      drop._file = { name: f.name, size: f.size };
      renderFile(drop._file);
      persistCurrentValues();
    }

    input.addEventListener("change", function () { accept(input.files); });

    // the whole empty zone is a click target, not just the button
    drop.addEventListener("click", function (e) {
      if (drop.classList.contains("has-file")) return;
      if (e.target.closest("button")) return;
      if (input.disabled) return;
      input.click();
    });

    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        drop.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        drop.classList.remove("dragging");
      });
    });
    drop.addEventListener("drop", function (e) {
      accept(e.dataTransfer && e.dataTransfer.files);
    });

    if (saved) renderFile(saved); else renderEmpty();
    wrap.appendChild(drop);

    var err = document.createElement("div");
    err.className = "error-msg";
    err.textContent = "Add your resume.";
    wrap.appendChild(err);

    return wrap;
  }

  /* Chip input — used by Tech stack, Skills, Preferred roles / locations. */
  function buildTagsField(section, field, entryIndex, value, wrap) {
    var tags = Array.isArray(value) ? value.slice() : [];
    var id = fieldId(section.id, entryIndex, field.name);

    var top = document.createElement("div");
    top.className = "field-top";
    top.innerHTML = "<label for='" + id + "'>" + esc(field.label) +
      (field.required ? '<span class="req">*</span>' : "") + "</label>";
    wrap.appendChild(top);

    var store = document.createElement("div");
    store.dataset.name = field.name;
    store.dataset.kind = "tags";
    store._tags = tags;

    var inputRow = document.createElement("div");
    inputRow.className = "tag-input-row";
    var input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.placeholder = field.placeholder || "";
    inputRow.appendChild(input);

    var addBtn = null;
    if (!field.noAddButton) {
      addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "tag-add";
      addBtn.setAttribute("aria-label", "Add");
      addBtn.innerHTML = ICONS.plus;
      inputRow.appendChild(addBtn);
    }
    store.appendChild(inputRow);

    if (field.helper) {
      var h = document.createElement("div");
      h.className = "helper";
      h.textContent = field.helper;
      store.appendChild(h);
    }

    var quick = null;
    if (field.quickAdds) {
      quick = document.createElement("div");
      quick.className = "quick-adds";
      quick.innerHTML = '<div class="quick-label">Quick adds</div>';
      var qrow = document.createElement("div");
      qrow.className = "quick-row";
      field.quickAdds.forEach(function (q) {
        var qb = document.createElement("button");
        qb.type = "button";
        qb.className = "quick-chip";
        qb.textContent = q;
        qb.addEventListener("click", function () { add(q); });
        qrow.appendChild(qb);
      });
      quick.appendChild(qrow);
      store.appendChild(quick);
    }

    var list = document.createElement("div");
    list.className = "tag-list" + (field.emptyText ? " tag-list-boxed" : "");
    store.appendChild(list);

    function render() {
      list.innerHTML = "";
      if (!tags.length && field.emptyText) {
        var em = document.createElement("div");
        em.className = "tag-empty";
        em.textContent = field.emptyText;
        list.appendChild(em);
        return;
      }
      tags.forEach(function (t, i) {
        var chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.innerHTML = "<span>" + esc(t) + "</span>";
        var x = document.createElement("button");
        x.type = "button";
        x.className = "tag-remove";
        x.setAttribute("aria-label", "Remove " + t);
        x.innerHTML = ICONS.close;
        x.addEventListener("click", function () {
          tags.splice(i, 1);
          store._tags = tags;
          render();
          fitBody();
        });
        chip.appendChild(x);
        list.appendChild(chip);
      });
    }

    function add(v) {
      v = String(v == null ? "" : v).trim();
      if (!v) return;
      if (tags.indexOf(v) === -1) tags.push(v);
      store._tags = tags;
      input.value = "";
      clearFieldError(wrap, []);
      render();
      fitBody();
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input.value); }
    });
    if (addBtn) addBtn.addEventListener("click", function () { add(input.value); });

    render();
    wrap.appendChild(store);

    var err = document.createElement("div");
    err.className = "error-msg";
    err.textContent = "Add at least one.";
    wrap.appendChild(err);

    return wrap;
  }

  /* ----------------------------------------------------------
     6b. Dependent dropdowns
         State  <- country code   (ISO 3166-2 subdivisions)
         Specialization <- degree (course catalogue)
     Both lists live in data.js. A field with `dependsOn` is rebuilt in
     place whenever the field it depends on changes.
     ---------------------------------------------------------- */
  function optionsForField(field, values) {
    var src = field.optionsFrom;
    if (!src) return field.options || [];

    if (src === "degrees") {
      return Object.keys(window.AB_DEGREES || {});
    }
    var dep = values ? values[field.dependsOn] : "";
    if (src === "states") {
      var iso = String(dep || "").toUpperCase();
      return (window.AB_STATES && window.AB_STATES[iso]) || [];
    }
    if (src === "specializations") {
      return (window.AB_DEGREES && window.AB_DEGREES[dep]) || [];
    }
    if (src === "cities") {
      var cc = String((values && values.countryCode) || "").toUpperCase();
      var byCountry = (window.AB_CITIES && window.AB_CITIES[cc]) || null;
      return (byCountry && byCountry[dep]) || [];
    }
    return field.options || [];
  }

  /* Rebuild every field in `scope` that depends on `changedName`, keeping the
     current value only when it still exists in the new list. */
  function refreshDependents(section, scope, changedName, entryIndex) {
    section.fields.forEach(function (field) {
      if (field.dependsOn !== changedName) return;

      var oldNode = scope.querySelector('.field[data-field="' + field.name + '"]');
      if (!oldNode) return;

      var current = scope.querySelector('[data-name="' + field.name + '"]');
      var kept = current ? current.value : "";

      var values = readScope(section, scope);
      var opts = optionsForField(field, values);
      if (opts.indexOf(kept) === -1) kept = "";

      var fresh = buildField(section, field, entryIndex, kept, values);
      oldNode.parentNode.replaceChild(fresh, oldNode);
      if (!state.editing) setFieldsEditable(false);

      // chains: country -> state -> city, degree -> specialization
      refreshDependents(section, scope, field.name, entryIndex);
    });
  }

  function buildField(section, field, entryIndex, value, allValues) {
    var wrap = document.createElement("div");
    wrap.className = "field";
    wrap.dataset.field = field.name;

    if (field.kind === "checkbox") {
      wrap.className = field.inline ? "field field-inline-check" : "";
      var lbl = document.createElement("label");
      lbl.className = "checkbox";
      lbl.innerHTML =
        '<input type="checkbox" data-name="' + esc(field.name) + '"' + (value ? " checked" : "") + '>' +
        "<span>" + esc(field.label) + "</span>";
      wrap.appendChild(lbl);
      return wrap;
    }

    /* ---- static copy ---- */
    if (field.kind === "note") {
      wrap.className = "note" + (field.muted ? " note-muted" : "");
      if (field.html) wrap.innerHTML = field.html;
      else wrap.textContent = field.text || "";
      return wrap;
    }

    /* ---- standalone action button (not a form control) ---- */
    if (field.kind === "action") {
      wrap.className = "action-wrap";
      var act = document.createElement("button");
      act.type = "button";
      act.className = "btn-action";
      act.innerHTML = (field.icon === "mic" ? ICONS.mic : "") + "<span>" + esc(field.label) + "</span>";
      wrap.appendChild(act);
      return wrap;
    }

    /* ---- "Open to work" style switch panel ---- */
    if (field.kind === "toggle") {
      wrap.className = "toggle-panel";
      wrap.dataset.field = field.name;
      var tid = fieldId(section.id, entryIndex, field.name);
      wrap.innerHTML =
        '<div class="toggle-copy">' +
          '<div class="toggle-title">' + esc(field.title) + "</div>" +
          '<div class="toggle-text">' + esc(field.text) + "</div>" +
        "</div>" +
        '<label class="switch" for="' + tid + '">' +
          '<input type="checkbox" id="' + tid + '" data-name="' + esc(field.name) + '"' +
            (value ? " checked" : "") + ">" +
          "<span></span>" +
        "</label>";
      return wrap;
    }

    /* ---- row of checkboxes ---- */
    if (field.kind === "checkgroup") {
      var chosen = Array.isArray(value) ? value : [];
      var head = document.createElement("div");
      head.className = "field-top";
      head.innerHTML = "<label>" + esc(field.label) + "</label>";
      wrap.appendChild(head);

      var group = document.createElement("div");
      group.className = "checkgroup";
      group.dataset.name = field.name;
      group.dataset.kind = "checkgroup";
      (field.options || []).forEach(function (o) {
        var l = document.createElement("label");
        l.className = "checkbox";
        l.innerHTML =
          '<input type="checkbox" value="' + esc(o) + '"' +
          (chosen.indexOf(o) > -1 ? " checked" : "") + "><span>" + esc(o) + "</span>";
        group.appendChild(l);
      });
      wrap.appendChild(group);
      return wrap;
    }

    /* ---- chip input: type, press Enter or + to add ---- */
    if (field.kind === "tags") {
      return buildTagsField(section, field, entryIndex, value, wrap);
    }

    /* ---- country picker ---- */
    if (field.kind === "phone") {
      return buildPhoneField(section, field, entryIndex, value, wrap, allValues);
    }

    if (field.kind === "country") {
      return buildCountryField(section, field, entryIndex, value, wrap);
    }

    /* ---- resume upload ---- */
    if (field.kind === "file") {
      return buildFileField(section, field, entryIndex, value, wrap);
    }

    var id = fieldId(section.id, entryIndex, field.name);

    if (field.icon) {
      wrap.classList.add("field-linked");
      var ic = document.createElement("span");
      ic.className = "field-icon";
      ic.innerHTML = ICONS[field.icon] || "";
      wrap.appendChild(ic);
    }

    var top = document.createElement("div");
    top.className = "field-top";
    top.innerHTML =
      '<label for="' + id + '">' + esc(field.label) +
      (field.required ? '<span class="req">*</span>' : "") + "</label>" +
      (field.badge ? '<span class="verified">' + esc(field.badge) + "</span>" : "") +
      (field.counter ? '<span class="counter" data-counter>0/' + field.counter + "</span>" : "");
    wrap.appendChild(top);

    var control;

    if (field.kind === "monthyear") {
      control = document.createElement("div");
      control.className = "date-pair";
      var v = value && typeof value === "object" ? value : { month: "", year: "" };
      control.appendChild(makeSelect(id + "_m", field.name + ".month", MONTHS, v.month, "MM"));
      control.appendChild(makeSelect(id + "_y", field.name + ".year", YEARS, v.year, "YYYY"));
    } else if (field.kind === "select") {
      var opts = optionsForField(field, allValues);
      var depSet = !field.dependsOn ||
        !!(allValues && String(allValues[field.dependsOn] || "").length);

      if (!opts.length && field.fallbackText && depSet) {
        // nothing on file for this dependency — let them type it
        control = document.createElement("input");
        control.id = id;
        control.type = "text";
        control.dataset.name = field.name;
        control.placeholder = field.fallbackText;
        control.value = value == null ? "" : value;
      } else {
        var ph = field.placeholder || "Select";
        if (field.dependsOn && !opts.length) ph = field.emptyPlaceholder || ph;
        control = makeSelect(id, field.name, opts, opts.length ? value : "", ph);
        if (field.dependsOn && !opts.length) {
          control.disabled = true;
          control.dataset.locked = "1";      // stays locked even in edit mode
        }
      }
    } else if (field.kind === "textarea") {
      wrap.classList.add("field--area");
      control = document.createElement("textarea");
      control.id = id;
      control.dataset.name = field.name;
      control.placeholder = field.placeholder || "";
      if (field.counter) control.maxLength = field.counter;
      control.value = value || "";
    } else {
      control = document.createElement("input");
      control.id = id;
      control.type = field.type || "text";
      control.dataset.name = field.name;
      control.placeholder = field.placeholder || "";
      if (field.maxlength) control.maxLength = field.maxlength;
      control.value = value || "";
    }

    wrap.appendChild(control);

    if (field.helper) {
      var h = document.createElement("div");
      h.className = "helper";
      h.textContent = field.helper;
      wrap.appendChild(h);
    }

    var err = document.createElement("div");
    err.className = "error-msg";
    err.textContent = "This field is required.";
    wrap.appendChild(err);

    // counter wiring
    if (field.counter) {
      var counterEl = top.querySelector("[data-counter]");
      var sync = function () {
        counterEl.textContent = control.value.length + "/" + field.counter;
      };
      control.addEventListener("input", sync);
      sync();
    }

    // filled styling like the reference (values give warm border)
    var markFilled = function (node) {
      if (node.value && node.value.length) node.classList.add("filled");
      else node.classList.remove("filled");
    };
    if (control.tagName === "INPUT" || control.tagName === "TEXTAREA") {
      markFilled(control);
      control.addEventListener("input", function () {
        markFilled(control);
        var v = String(control.value).trim();
        if (v && !formatError(field, v)) clearFieldError(wrap, [control]);
      });
      control.addEventListener("blur", function () {
        var msg = formatError(field, control.value);
        if (msg) { setFieldMessage(wrap, msg); markFieldInvalid(wrap, [control]); }
      });
    } else {
      control.addEventListener("change", function () {
        var pair = Array.prototype.slice.call(wrap.querySelectorAll("[data-kind=pick]"));
        if (pair.every(function (n) { return n.value; })) clearFieldError(wrap, pair);
      });
    }

    return wrap;
  }

  /* Plain dropdowns use the same control and menu as the country picker.
     The element exposes a `value` property, so every existing read and
     validate path keeps working as if it were a <select>. */
  function makeSelect(id, name, options, value, placeholder) {
    var el = document.createElement("button");
    el.type = "button";
    el.id = id;
    el.className = "pick-control";
    el.dataset.name = name;
    el.dataset.kind = "pick";

    var current = value == null ? "" : String(value);

    Object.defineProperty(el, "value", {
      get: function () { return current; },
      set: function (v) { current = v == null ? "" : String(v); paint(); }
    });

    function paint() {
      el.innerHTML =
        (current
          ? '<span class="pick-label">' + esc(current) + "</span>"
          : '<span class="pick-ph">' + esc(placeholder) + "</span>") +
        '<svg class="pick-caret" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
    }

    el.addEventListener("click", function () {
      if (el._menu) { el._close(); return; }
      openPicker(el, {
        search: options.length > 10,
        searchPlaceholder: "Search",
        minWidth: Math.max(160, el.getBoundingClientRect().width),
        maxHeight: 280,
        items: options,
        match: function (o, q) { return String(o).toLowerCase().indexOf(q) > -1; },
        isSelected: function (o) { return String(o) === current; },
        renderRow: function (o) { return '<span class="pick-label">' + esc(o) + "</span>"; },
        onPick: function (o) {
          current = String(o);
          paint();
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    });

    paint();
    return el;
  }

  /* group fields into rows by their `col` width (12-col grid) */
  function buildFieldGroup(section, entryIndex, values) {
    var frag = document.createDocumentFragment();
    var buffer = [];
    var weights = [];
    var bufferWidth = 0;

    function flush() {
      if (!buffer.length) return;
      var count = buffer.length;
      var row = document.createElement("div");
      row.className = "row cols-" + (count > 3 ? 3 : count);

      var total = weights.reduce(function (a, w) { return a + w; }, 0);
      var cols = weights.slice();
      // a row that does not fill 12 columns keeps its declared width, with the
      // remainder left as empty space rather than stretching to fit
      if (total < 12) cols.push(12 - total);

      if (cols.length > 1 &&
          (total < 12 || cols.some(function (w) { return w !== cols[0]; }))) {
        row.style.gridTemplateColumns = cols.map(function (w) {
          return w + "fr";
        }).join(" ");
      }
      // a textarea row absorbs the card's spare height so nothing overflows
      if (section.type !== "repeat" && buffer.some(function (n) {
        return n.classList && n.classList.contains("field--area");
      })) row.classList.add("grow");
      buffer.forEach(function (n) { row.appendChild(n); });
      frag.appendChild(row);
      buffer = [];
      weights = [];
      bufferWidth = 0;
    }

    section.fields.forEach(function (field) {
      var val = values ? values[field.name] : undefined;

      // drawn inside another control (the country code inside Phone)
      if (field.renderedBy) return;

      if (field.kind === "checkbox") {
        flush();
        frag.appendChild(buildField(section, field, entryIndex, val, values));
        return;
      }

      var w = field.col || 12;
      if (field.newRow) flush();              // start a fresh row
      if (bufferWidth + w > 12) flush();
      buffer.push(buildField(section, field, entryIndex, val, values));
      weights.push(w);
      bufferWidth += w;
      if (bufferWidth >= 12) flush();
    });

    flush();
    return frag;
  }

  /* ----------------------------------------------------------
     6. Section rendering
     ---------------------------------------------------------- */
  function renderSection() {
    var section = profileSections[state.currentSectionIndex];

    el.body.dataset.section = section.id;
    el.title.textContent = (state.currentSectionIndex + 1) + ". " + section.title;
    el.desc.textContent = section.description;
    el.body.innerHTML = "";

    if (section.type === "repeat") {
      var entries = state.values[section.id];
      if (!Array.isArray(entries) || !entries.length) entries = [{}];

      var container = document.createElement("div");
      container.className = "entries";
      container.dataset.repeat = "true";
      entries.forEach(function (vals, i) {
        container.appendChild(buildEntry(section, i, vals));
      });
      el.body.appendChild(container);

      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "add-more";
      addBtn.textContent = section.addLabel || "+ Add More";
      addBtn.addEventListener("click", function () {
        container.appendChild(buildEntry(section, container.children.length, {}));
        renumberEntries(container, section);
        fitBody();
      });
      el.body.appendChild(addBtn);
    } else {
      el.body.appendChild(buildFieldGroup(section, 0, state.values[section.id] || {}));
    }

    if (section.intro) {
      var intro = document.createElement("div");
      intro.className = "section-intro";
      intro.textContent = section.intro;
      el.body.insertBefore(intro, el.body.firstChild);
    }

    applyConditionalFields();
    updateButtons();
    resetSectionMode();
    renderChecklist();
    updateSectionProgress();
    fitBody();
  }

  /* The card never scrolls. Only if dynamically added entries ("+ Add More")
     genuinely exceed the card do we let the body scroll, so nothing is clipped
     out of reach. The designed sections all fit as-is. */
  function fitBody() {
    el.body.classList.remove("scrollable");
    requestAnimationFrame(function () {
      if (el.body.scrollHeight > el.body.clientHeight + 1) {
        el.body.classList.add("scrollable");
      }
    });
  }

  function buildEntry(section, index, values) {
    var entry = document.createElement("div");
    entry.className = "entry";

    var head = document.createElement("div");
    head.className = "entry-head";
    head.innerHTML =
      '<div class="entry-title">' + esc(section.entryLabel || "Entry") + " " + (index + 1) + "</div>";

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "entry-remove";
    remove.setAttribute("aria-label", "Delete entry");
    remove.title = "Delete this entry";
    remove.innerHTML =
      '<svg viewBox="0 0 24 24">' +
      '<path d="M3 6h18"/>' +
      '<path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>' +
      '<path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"/>' +
      '<path d="M10 11v6"/><path d="M14 11v6"/>' +
      "</svg><span>Delete</span>";
    remove.addEventListener("click", function () {
      var container = entry.parentNode;
      if (container.children.length === 1) {
        // keep at least one entry — clear it instead
        Array.prototype.forEach.call(entry.querySelectorAll("input, textarea, select"), function (n) {
          if (n.type === "checkbox") n.checked = false; else n.value = "";
          n.classList.remove("filled", "invalid");
        });
        applyConditionalFields();
        return;
      }
      container.removeChild(entry);
      renumberEntries(container, section);
      fitBody();
    });
    head.appendChild(remove);
    entry.appendChild(head);

    entry.appendChild(buildFieldGroup(section, index, values || {}));
    return entry;
  }

  function renumberEntries(container, section) {
    Array.prototype.forEach.call(container.children, function (child, i) {
      var t = child.querySelector(".entry-title");
      if (t) t.textContent = (section.entryLabel || "Entry") + " " + (i + 1);
    });
    applyConditionalFields();
  }

  /* "Ending in" hides when "Currently working here" is ticked */
  function applyConditionalFields() {
    var section = profileSections[state.currentSectionIndex];
    var scopes = section.type === "repeat"
      ? Array.prototype.slice.call(el.body.querySelectorAll(".entry"))
      : [el.body];

    section.fields.forEach(function (field) {
      if (!field.hideWhen) return;
      scopes.forEach(function (scope) {
        var trigger = scope.querySelector('input[type=checkbox][data-name="' + field.hideWhen + '"]');
        var target = scope.querySelector('.field[data-field="' + field.name + '"]');
        if (!trigger || !target) return;
        var hide = trigger.checked;
        target.style.visibility = hide ? "hidden" : "";
        target.style.pointerEvents = hide ? "none" : "";
        if (!trigger.dataset.bound) {
          trigger.dataset.bound = "1";
          trigger.addEventListener("change", applyConditionalFields);
        }
      });
    });
  }

  /* ----------------------------------------------------------
     7. Reading + validating the current section
     ---------------------------------------------------------- */
  function readScope(section, scope) {
    var out = {};
    section.fields.forEach(function (field) {
      if (!field.name) return;                      // note / action blocks

      if (field.kind === "monthyear") {
        var m = scope.querySelector('[data-name="' + field.name + '.month"]');
        var y = scope.querySelector('[data-name="' + field.name + '.year"]');
        out[field.name] = { month: m ? m.value : "", year: y ? y.value : "" };
        return;
      }

      var node = scope.querySelector('[data-name="' + field.name + '"]');
      if (!node) return;

      if (node.dataset.kind === "tags") {
        out[field.name] = (node._tags || []).slice();
        return;
      }
      if (node.dataset.kind === "country") {
        out[field.name] = node._value || "";
        return;
      }
      if (node.dataset.kind === "file") {
        out[field.name] = node._file || null;
        return;
      }
      if (node.dataset.kind === "checkgroup") {
        out[field.name] = Array.prototype.slice
          .call(node.querySelectorAll("input:checked"))
          .map(function (n) { return n.value; });
        return;
      }
      out[field.name] = node.type === "checkbox" ? node.checked : node.value;
    });
    return out;
  }

  function collectValues() {
    var section = profileSections[state.currentSectionIndex];
    if (section.type === "repeat") {
      var entries = Array.prototype.slice.call(el.body.querySelectorAll(".entry"));
      return entries.map(function (entry) { return readScope(section, entry); });
    }
    return readScope(section, el.body);
  }

  /* ----------------------------------------------------------
     7b. Data-type checks — "Incorrect entry" for malformed values
     ---------------------------------------------------------- */
  var FORMATS = {
    email: {
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); },
      msg: "Incorrect entry — use name@example.com."
    },
    url: {
      test: function (v) { return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/.test(v); },
      msg: "Incorrect entry — the link must start with http:// or https://."
    },
    phone: {
      test: function (v) { return /^\+?[0-9][0-9\s\-()]{6,17}$/.test(v); },
      msg: "Incorrect entry — 7 to 15 digits, optionally starting with +."
    },
    countryCode: {
      test: function (v) { return /^[A-Za-z]{2}$/.test(v); },
      msg: "Incorrect entry — two letters, e.g. IN."
    },
    days: {
      test: function (v) { return /^\d{1,3}$/.test(v) && +v <= 365; },
      msg: "Incorrect entry — a whole number of days (0-365)."
    },
    score: {
      test: function (v) { return /^\d{1,3}(\.\d{1,2})?$/.test(v) && +v <= 100; },
      msg: "Incorrect entry — a number, e.g. 7.9 or 82."
    }
  };

  /* Returns an error message when the value is present but malformed. */
  function formatError(field, value) {
    if (!field.validate) return null;
    var v = String(value == null ? "" : value).trim();
    if (!v) return null;                          // emptiness is the required check's job
    var rule = FORMATS[field.validate];
    return rule && !rule.test(v) ? rule.msg : null;
  }

  /* --- error helpers, so the states stay in one place --- */
  function setFieldMessage(wrap, msg) {
    var e = wrap.querySelector(".error-msg");
    if (e) e.textContent = msg;
  }

  function markFieldInvalid(wrap, nodes) {
    if (!wrap) return;
    wrap.classList.add("invalid", "has-error");
    (nodes || []).forEach(function (n) { if (n) n.classList.add("invalid"); });
    animateFieldError(wrap);
  }

  function clearFieldError(wrap, nodes) {
    if (!wrap) return;
    wrap.classList.remove("invalid", "has-error", "invalid-jitter");
    (nodes || []).forEach(function (n) { if (n) n.classList.remove("invalid"); });
  }

  /* Short horizontal shake on the field only — never the card or the page. */
  function animateFieldError(wrap) {
    wrap.classList.remove("invalid-jitter");
    void wrap.offsetWidth;                       // restart the animation
    wrap.classList.add("invalid-jitter");
  }

  function clearAllFieldErrors() {
    Array.prototype.forEach.call(el.body.querySelectorAll(".field"), function (w) {
      w.classList.remove("invalid", "has-error", "invalid-jitter");
    });
    Array.prototype.forEach.call(el.body.querySelectorAll(".invalid"), function (n) {
      n.classList.remove("invalid");
    });
  }

  function validateCurrent() {
    var section = profileSections[state.currentSectionIndex];
    var scopes = section.type === "repeat"
      ? Array.prototype.slice.call(el.body.querySelectorAll(".entry"))
      : [el.body];

    var firstBad = null;

    scopes.forEach(function (scope) {
      section.fields.forEach(function (field) {
        if (!field.required && !field.validate) return;

        var wrap = scope.querySelector('.field[data-field="' + field.name + '"]');
        if (!wrap) return;
        if (wrap.style.visibility === "hidden") return; // conditionally hidden

        var nodes, empty;

        /* the combined control: country first, then the number, with one
           message and one jitter for the whole box */
        if (field.kind === "phone") {
          var pcode = scope.querySelector('[data-name="' + field.codeName + '"]');
          var pnum = scope.querySelector('[data-name="' + field.name + '"]');
          var box = wrap.querySelector(".phone-combo");
          if (pcode && !pcode._value) {
            setFieldMessage(wrap, "Choose a country code.");
            markFieldInvalid(wrap, box ? [box] : []);
            if (!firstBad) firstBad = pcode;
            return;
          }
          if (pnum && !String(pnum.value).trim()) {
            if (field.required) {
              setFieldMessage(wrap, "This field is required.");
              markFieldInvalid(wrap, box ? [box] : []);
              if (!firstBad) firstBad = pnum;
              return;
            }
            clearFieldError(wrap, box ? [box] : []);
            return;
          }
          var pfmt = pnum ? formatError(field, pnum.value) : null;
          if (pfmt) {
            setFieldMessage(wrap, pfmt);
            markFieldInvalid(wrap, box ? [box] : []);
            if (!firstBad) firstBad = pnum;
          } else {
            clearFieldError(wrap, box ? [box] : []);
          }
          return;
        }

        if (field.kind === "country") {
          var cnode = scope.querySelector('[data-name="' + field.name + '"]');
          if (field.required && cnode && !cnode._value) {
            setFieldMessage(wrap, "Choose a country.");
            markFieldInvalid(wrap, []);
            if (!firstBad) firstBad = cnode;
          } else {
            clearFieldError(wrap, []);
          }
          return;
        }
        if (field.kind === "file") {
          if (!field.required) return;
          var fnode = scope.querySelector('[data-name="' + field.name + '"]');
          if (fnode && !fnode._file) {
            markFieldInvalid(wrap, []);
            if (!firstBad) firstBad = fnode.querySelector(".file-browse");
          } else {
            clearFieldError(wrap, []);
          }
          return;
        }

        if (field.kind === "tags") {
          if (!field.required) return;
          var store = scope.querySelector('[data-name="' + field.name + '"]');
          if (store && !(store._tags || []).length) {
            markFieldInvalid(wrap, []);
            if (!firstBad) firstBad = store.querySelector("input");
          } else {
            clearFieldError(wrap, []);
          }
          return;
        }

        if (field.kind === "monthyear" && !field.required) return;
        if (field.kind === "monthyear") {
          nodes = [
            scope.querySelector('[data-name="' + field.name + '.month"]'),
            scope.querySelector('[data-name="' + field.name + '.year"]')
          ].filter(Boolean);
          empty = nodes.some(function (n) { return !n.value; });
        } else {
          nodes = [scope.querySelector('[data-name="' + field.name + '"]')].filter(Boolean);
          empty = nodes.some(function (n) { return !String(n.value).trim(); });
        }

        if (empty && field.required) {
          setFieldMessage(wrap, "This field is required.");
          markFieldInvalid(wrap, nodes.filter(function (n) { return !n.value; }));
          if (!firstBad) firstBad = nodes[0];
          return;
        }

        var fmt = nodes.length === 1 ? formatError(field, nodes[0].value) : null;
        if (fmt) {
          setFieldMessage(wrap, fmt);
          markFieldInvalid(wrap, nodes);
          if (!firstBad) firstBad = nodes[0];
        } else {
          clearFieldError(wrap, nodes);
        }
      });
    });

    if (firstBad) {
      /* Missing data must be editable, so a failed check always opens edit mode. */
      if (!state.editing) { state.editing = true; applySectionMode(); }
      firstBad.focus({ preventScroll: true });
      /* No scrollIntoView: the whole form is designed to sit inside the viewport.
         Only scroll when the body genuinely overflows on a small layout. */
      if (el.body.classList.contains("scrollable")) {
        firstBad.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return false;
    }
    return true;
  }

  function persistCurrentValues() {
    var section = profileSections[state.currentSectionIndex];
    state.values[section.id] = collectValues();
    saveState();
  }

  /* ----------------------------------------------------------
     8. Checklist
     ---------------------------------------------------------- */
  /* Figma icon set (18 x 18) — check-circle-2 and alert-triangle */
  function checkIconMarkup() {
    return '<span class="mark"><svg viewBox="0 0 24 24">' +
      '<circle class="disc" cx="12" cy="12" r="10"></circle>' +
      '<path class="tick" d="m9 12 2 2 4-4" fill="none"></path>' +
      "</svg></span>";
  }

  function warnIconMarkup() {
    return '<span class="mark"><svg viewBox="0 0 24 24">' +
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>' +
      '<path d="M12 9v4"></path><path d="M12 17h.01"></path>' +
      "</svg></span>";
  }

  function renderChecklist() {
    el.checklist.innerHTML = "";
    profileSections.forEach(function (section, i) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "check-item";
      if (section.completed) btn.classList.add("completed");
      else if (section.attention) btn.classList.add("attention");

      var isCurrent = i === state.currentSectionIndex;
      if (isCurrent) btn.classList.add("current");

      btn.innerHTML = "<span>" + esc(section.title) + "</span>";

      // the active tab carries an edit pencil (Figma 1449:345)
      if (isCurrent) {
        var pencil = document.createElement("button");
        pencil.type = "button";
        pencil.className = "tab-edit";
        pencil.title = "Edit this section";
        pencil.setAttribute("aria-label", "Edit " + section.title);
        pencil.innerHTML = ICONS.pencil;
        pencil.addEventListener("click", function (e) {
          // must not fall through to the tab's navigation handler
          e.stopPropagation();
          e.preventDefault();
          openForm(i, true);        // slide the form in, already editable
        });
        btn.appendChild(pencil);
      }

      btn.addEventListener("click", function () {
        // free navigation — does NOT mark anything complete
        goToSection(i);
        openForm();
        closeSidebar();
      });

      li.appendChild(btn);
      el.checklist.appendChild(li);
    });
  }

  /* ----------------------------------------------------------
     8b. Edit-mode state machine:  VIEW/SAVED -> EDIT -> SAVED
     ---------------------------------------------------------- */
  function applySectionMode() {
    el.body.classList.toggle("editing", state.editing);
    el.body.classList.toggle("saved", !state.editing);
    if (el.editBtn) el.editBtn.classList.toggle("is-editing", state.editing);
    setFieldsEditable(state.editing);
    updateButtons();
  }

  /* Outside edit mode nothing in the form accepts input. Text controls use
     readOnly (so the value still reads back and stays accessible); everything
     else that has no readOnly is disabled. */
  function setFieldsEditable(on) {
    Array.prototype.forEach.call(
      el.body.querySelectorAll("input, textarea, select, button"),
      function (n) {
        var tag = n.tagName;
        // a dropdown waiting on the field it depends on is never enabled
        if (n.dataset && n.dataset.locked === "1") { n.disabled = true; return; }

        if (tag === "TEXTAREA" || (tag === "INPUT" && !/^(checkbox|radio|file)$/.test(n.type))) {
          n.readOnly = !on;
          n.tabIndex = on ? 0 : -1;
        } else {
          n.disabled = !on;
        }
      }
    );
  }

  /* A section that has never been saved is editable by definition. */
  function resetSectionMode() {
    state.editing = !profileSections[state.currentSectionIndex].completed;
    applySectionMode();
  }

  function enterEditMode() {
    if (state.editing) return;
    state.editing = true;
    applySectionMode();
    var first = el.body.querySelector("input:not([type=file]):not(.pick-search), textarea");
    if (first) first.focus();
  }

  function exitEditMode() {
    state.editing = false;
    clearAllFieldErrors();
    applySectionMode();
  }

  /* ----------------------------------------------------------
     9. Completion percentage (single source of truth)
     ---------------------------------------------------------- */
  function updateProfileCompletion() {
    var completed = profileSections.filter(function (s) { return s.completed; }).length;
    var percentage = Math.round((completed / TOTAL) * 100);
    updateCircularProgress(percentage);
    updateCompletionBadge(percentage);
    return percentage;
  }

  function updateCircularProgress(percentage) {
    var offset = RING_CIRCUMFERENCE * (1 - percentage / 100);
    el.ring.style.strokeDashoffset = offset;
  }

  function updateCompletionBadge(percentage) {
    if (el.pctNum) el.pctNum.textContent = percentage + "%";
    if (el.pctBadge) el.pctBadge.classList.toggle("full", percentage === 100);
    if (el.ringCheck) el.ringCheck.classList.toggle("show", percentage === 100);
  }

  /* ----------------------------------------------------------
     10. Header progress — completion-driven, not navigation-driven
     ---------------------------------------------------------- */
  /* Purely completion-driven. 0 completed => 0% => the header stays white.
     Opening a section never fills the bar; only Next/Save does. */
  function updateSectionProgress() {
    var completed = profileSections.filter(function (s) { return s.completed; }).length;
    var progress = (completed / TOTAL) * 100;
    el.progress.style.width = progress + "%";
  }

  /* ----------------------------------------------------------
     11. Final completion animation
     ---------------------------------------------------------- */
  function runCompletionCelebration() {
    el.progress.classList.remove("finished");
    void el.progress.offsetWidth; // restart animation
    el.progress.classList.add("finished");

    el.ringWrap.classList.remove("celebrate");
    void el.ringWrap.offsetWidth;
    el.ringWrap.classList.add("celebrate");

  }

  function applyCompletedVisualState() {
    // restored 100% state on reload — no replay of the animation
    el.progress.style.background = "#FFF7ED";
    el.progress.style.boxShadow = "0 0 18px rgba(241,90,58,.14)";
  }

  /* ----------------------------------------------------------
     12. Navigation
     ---------------------------------------------------------- */
  function isLast() { return state.currentSectionIndex === TOTAL - 1; }

  /* The primary action always reads "Save". It only exists while the section is
     open for editing — a completed section nobody is editing has nothing to
     save, so the button is taken out of the layout entirely. */
  /* Previous is always on screen — it is simply disabled on the first section.
     The primary button is "Save" while a section is open for editing, and
     "Next" once it is saved and closed, so there is always a way forward. */
  function updateButtons() {
    var section = profileSections[state.currentSectionIndex];
    var canSave = state.editing || !section.completed;

    el.prevBtn.hidden = false;
    el.prevBtn.disabled = state.currentSectionIndex === 0;

    el.nextBtn.textContent = canSave ? "Save" : "Next";
    el.nextBtn.classList.toggle("save", canSave);
    el.nextBtn.hidden = !canSave && isLast();   // nothing after the last section
  }

  /* Plain navigation — moves without committing anything. */
  function goToSection(i) {
    if (i < 0 || i >= TOTAL) return;
    persistCurrentValues();
    state.currentSectionIndex = i;
    saveState();
    renderSection();
  }

  function handlePrimary() {
    var section = profileSections[state.currentSectionIndex];
    if (state.editing || !section.completed) handleNext();
    else goToSection(state.currentSectionIndex + 1);
  }

  function handleNext() {
    if (!validateCurrent()) return;

    var section = profileSections[state.currentSectionIndex];

    persistCurrentValues();

    // mark completed — only Next/Save does this
    section.completed = true;
    state.completed[section.id] = true;

    var pct = updateProfileCompletion();
    renderChecklist();

    if (isLast()) {
      exitEditMode();                 // committed -> borders come off
      updateSectionProgress();
      if (pct === 100) {
        state.celebrated = true;
        runCompletionCelebration();
      }
      saveState();
      closeForm();
      return;
    }

    // saving returns you to the report card, where the change is now visible
    saveState();
    renderSection();
    closeForm();
  }

  function handlePrev() {
    if (state.currentSectionIndex === 0) return;
    goToSection(state.currentSectionIndex - 1);
  }

  /* ----------------------------------------------------------
     12a. Review Profile — the report card
     A read-only rendering of everything captured so far, rebuilt from
     state.values every time it is opened or a section is saved, so it is
     never out of date. Each card links straight back to its section.
     ---------------------------------------------------------- */
  var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var RV_ICON = {
    basic: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    career: '<path d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z"/><path d="M10 7V5h4v2"/>',
    education: '<path d="m22 9-10-5L2 9l10 5 10-5Z"/><path d="M6 11.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5.5"/>',
    skills: '<path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>',
    languages: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z"/>',
    experience: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 20V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v15"/>',
    projects: '<path d="m16 18 5-6-5-6"/><path d="m8 6-5 6 5 6"/>',
    summary: '<path d="M4 5h16"/><path d="M4 10h16"/><path d="M4 15h11"/><path d="M4 20h7"/>',
    certifications: '<circle cx="12" cy="9" r="6"/><path d="M15.5 13.5 17 22l-5-2.8L7 22l1.5-8.5"/>',
    links: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7L12.5 20"/>',
    references: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    resume: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>'
  };

  function monthYear(v) {
    if (!v || !v.year) return "";
    var m = parseInt(v.month, 10);
    var name = m >= 1 && m <= 12 ? MONTH_SHORT[m - 1] : "";
    return name ? name + " '" + String(v.year).slice(-2) : String(v.year);
  }

  function span(a, b, currentLabel) {
    var from = monthYear(a);
    var to = currentLabel ? "Present" : monthYear(b);
    if (!from && !to) return "";
    return from && to ? from + " to " + to : from || to;
  }

  function val(sectionId, name) {
    var v = state.values[sectionId];
    if (!v || Array.isArray(v)) return "";
    var x = v[name];
    return x == null ? "" : x;
  }

  function rows(sectionId) {
    var v = state.values[sectionId];
    if (!Array.isArray(v)) return [];
    return v.filter(function (r) {
      return r && Object.keys(r).some(function (k) {
        var x = r[k];
        return Array.isArray(x) ? x.length : (x && typeof x === "object" ? x.year : x);
      });
    });
  }

  function chips(list) {
    if (!list || !list.length) return "";
    return '<div class="rv-chips">' + list.map(function (t) {
      return '<span class="rv-chip">' + esc(t) + "</span>";
    }).join("") + "</div>";
  }

  function line(label, value) {
    if (!value) return "";
    return '<div class="rv-pair"><span class="rv-k">' + esc(label) +
           '</span><span class="rv-v">' + esc(value) + "</span></div>";
  }

  var rvGaps = [];    // titles of the cards with nothing in them
  var rvCards = [];   // { html, filled } in tab order

  /* one card */
  function card(sectionId, title, bodyHtml, emptyHint, iconKey, count, noGap) {
    var i = profileSections.findIndex(function (s) { return s.id === sectionId; });
    var filled = !!(bodyHtml && bodyHtml.trim());
    if (!filled && !noGap) rvGaps.push(title);

    var icon = RV_ICON[iconKey || sectionId] || RV_ICON.summary;

    rvCards.push({
      filled: filled,
      html: '<section class="rv-card' + (filled ? "" : " is-empty") + '">' +
        '<div class="rv-card-head">' +
          '<span class="rv-ico"><svg viewBox="0 0 24 24">' + icon + "</svg></span>" +
          '<h3>' + esc(title) + "</h3>" +
          (count > 1 ? '<span class="rv-count">' + count + "</span>" : "") +
          '<button type="button" class="rv-add" data-goto="' + i + '">' +
            (filled ? "Edit" : "Add") +
          "</button>" +
        "</div>" +
        '<div class="rv-card-body">' +
          (filled ? bodyHtml : '<p class="rv-empty">' + esc(emptyHint) + "</p>") +
        "</div>" +
      "</section>"
    });
    return "";
  }

  function buildReview() {
    var out = [];
    rvGaps = [];
    rvCards = [];

    /* ---- identity ---- */
    var name = [val("basic", "firstName"), val("basic", "middleName"), val("basic", "lastName")]
      .filter(Boolean).join(" ");
    var place = [val("basic", "city"), val("basic", "state")].filter(Boolean).join(", ");
    var iso = String(val("basic", "countryCode") || "").toUpperCase();
    var dial = findCountry(iso);
    var tel = val("basic", "phone");
    if (tel && dial && String(tel).indexOf("+") !== 0) tel = "+" + dial.dial + " " + tel;

    var photo = "";
    try { photo = localStorage.getItem(PHOTO_KEY) || ""; } catch (e) { /* ignore */ }
    var done = profileSections.filter(function (x) { return x.completed; }).length;
    var pct = Math.round((done / TOTAL) * 100);

    out.push(
      '<section class="rv-hero">' +
        '<div class="rv-hero-top">' +
          '<div class="rv-media-slot"></div>' +
          '<div class="rv-hero-copy">' +
            "<h2>" + esc(name || "Your name") + "</h2>" +
            (val("basic", "headline")
              ? '<p class="rv-headline">' + esc(val("basic", "headline")) + "</p>"
              : '<p class="rv-headline rv-muted">Add a headline so recruiters know what you do.</p>') +
            '<div class="rv-meta">' +
              (place ? '<span class="rv-meta-i">' + esc(place) + "</span>" : "") +
              (tel ? '<span class="rv-meta-i">' + esc(tel) + "</span>" : "") +
            "</div>" +
          "</div>" +
          '<button type="button" class="rv-add" data-goto="0">Edit</button>' +
        "</div>" +
        '<div class="rv-progress">' +
          '<div class="rv-progress-top">' +
            "<span>Profile strength</span>" +
            "<strong>" + pct + "%</strong>" +
          "</div>" +
          '<div class="rv-bar"><i style="width:' + pct + '%"></i></div>' +
        "</div>" +
      "</section>"
    );

    /* Basic Information is one card, the way it is one tab. The hero above
       carries the name, headline, location and phone; this holds the rest. */
    var about = val("basic", "about");
    var langs = val("basic", "languages");
    var file = val("basic", "resume");

    var basicBody = "";
    if (about) {
      basicBody += '<div class="rv-sub">Profile summary</div>' +
                   '<p class="rv-item-body rv-tight">' + esc(about) + "</p>";
    }
    if (langs && langs.length) {
      basicBody += '<div class="rv-sub">Languages</div>' + chips(langs);
    }
    if (file && file.name) {
      basicBody += '<div class="rv-sub">Resume</div>' +
        '<div class="rv-file"><span class="rv-file-name">' + esc(file.name) + "</span>" +
        '<span class="rv-file-meta">' + esc(formatBytes(file.size)) + "</span></div>";
    }
    out.push(card("basic", "Basic Information", basicBody,
      "Add your summary, the languages you speak and your resume.", "basic"));

    /* ---- experience ---- */
    var exp = rows("experience").map(function (r) {
      return '<div class="rv-item">' +
        '<div class="rv-item-title">' + esc(r.role || "Role") + "</div>" +
        '<div class="rv-item-sub">' +
          esc([r.company, r.employmentType, r.location].filter(Boolean).join(" · ")) +
        "</div>" +
        '<div class="rv-item-meta">' + esc(span(r.start, r.end, r.current)) + "</div>" +
        (r.description ? '<p class="rv-item-body">' + esc(r.description) + "</p>" : "") +
      "</div>";
    }).join("");
    out.push(card("experience", "Experience", exp,
      "Add the roles and internships you have done.", "experience", rows("experience").length));

    /* ---- education ---- */
    var edu = rows("education").map(function (r) {
      var head = [r.degree, r.department].filter(Boolean).join(" — ");
      return '<div class="rv-item">' +
        '<div class="rv-item-title">' + esc(head || r.school || "Education") + "</div>" +
        (r.school ? '<div class="rv-item-sub">' + esc(r.school) + "</div>" : "") +
        '<div class="rv-item-meta">' +
          esc([span(r.start, r.end, r.current),
               r.score ? "Scored " + r.score : ""].filter(Boolean).join(" · ")) +
        "</div>" +
      "</div>";
    }).join("");
    out.push(card("education", "Education", edu,
      "Add your degree, school and years so recruiters can place you.", "education", rows("education").length));

    /* ---- projects ---- */
    var proj = rows("projects").map(function (r) {
      return '<div class="rv-item">' +
        '<div class="rv-item-title">' + esc(r.name || "Project") + "</div>" +
        (r.description ? '<p class="rv-item-body">' + esc(r.description) + "</p>" : "") +
        chips(r.techStack) +
        (r.liveUrl || r.github
          ? '<div class="rv-links">' +
            (r.liveUrl ? '<a href="' + esc(r.liveUrl) + '" target="_blank" rel="noopener">Live</a>' : "") +
            (r.github ? '<a href="' + esc(r.github) + '" target="_blank" rel="noopener">Code</a>' : "") +
            "</div>"
          : "") +
      "</div>";
    }).join("");
    out.push(card("projects", "Projects", proj,
      "Show what you have built — with links a recruiter can open.", "projects", rows("projects").length));

    /* ---- mock interview (a tab, but nothing the student types) ---- */
    var mockDone = !!profileSections[4].completed;
    out.push(card("mock", "Mock Interview",
      mockDone
        ? '<p class="rv-item-body">Mock interview completed. Each finished interview keeps its own scored report.</p>'
        : "",
      "No mock interview yet — they are live voice interviews, and each one you finish keeps its own scored report.",
      "summary", 0, true));

    /* ---- skills ---- */
    out.push(card("skills", "Key skills", chips(val("skills", "skills")),
      "Add the skills you want to be found for.", "skills", (val("skills", "skills") || []).length));

    /* ---- certifications ---- */
    var cert = rows("certifications").map(function (r) {
      return '<div class="rv-item">' +
        '<div class="rv-item-title">' + esc(r.name || "Certification") + "</div>" +
        '<div class="rv-item-sub">' + esc(r.issuer || "") + "</div>" +
        '<div class="rv-item-meta">' + esc(span(r.issued, r.expires, false)) + "</div>" +
      "</div>";
    }).join("");
    out.push(card("certifications", "Certifications", cert,
      "Add certifications you hold — they carry weight with recruiters.", "certifications", rows("certifications").length));

    /* ---- links ---- */
    var lk = ["linkedin", "github", "portfolio", "resume"].map(function (k) {
      var u = val("links", k);
      if (!u) return "";
      var label = k === "resume" ? "Résumé" : k.charAt(0).toUpperCase() + k.slice(1);
      return '<div class="rv-pair"><span class="rv-k">' + label +
             '</span><a class="rv-v rv-a" href="' + esc(u) + '" target="_blank" rel="noopener">' +
             esc(u) + "</a></div>";
    }).join("");
    out.push(card("links", "Links", lk, "Add where your work lives.", "links"));

    /* ---- career preferences ---- */
    var pref = "";
    var types = val("career", "opportunityType");
    pref += line("Preferred job type", Array.isArray(types) ? types.join(", ") : "");
    pref += line("Open to work", val("career", "openToWork") ? "Yes" : "");
    pref += line("Work mode", val("career", "workMode"));
    pref += line("Notice period", val("career", "noticePeriod") ? val("career", "noticePeriod") + " days" : "");
    pref += line("Available from", monthYear(val("career", "availableFrom")));
    pref += line("Willing to relocate", val("career", "willingToRelocate") ? "Yes" : "");
    var roles = val("career", "preferredRoles"), locs = val("career", "preferredLocations");
    if (roles && roles.length) pref += '<div class="rv-sub">Preferred roles</div>' + chips(roles);
    if (locs && locs.length) pref += '<div class="rv-sub">Preferred locations</div>' + chips(locs);
    out.push(card("career", "Your career preferences", pref,
      "Tell recruiters what you are looking for — roles, locations and availability.", "career"));

    /* ---- references ---- */
    var ref = rows("references").map(function (r) {
      return '<div class="rv-item">' +
        '<div class="rv-item-title">' + esc(r.name || "Reference") + "</div>" +
        '<div class="rv-item-sub">' + esc(r.relationship || "") + "</div>" +
        '<div class="rv-item-meta">' + esc([r.email, r.phone].filter(Boolean).join(" · ")) + "</div>" +
      "</div>";
    }).join("");
    out.push(card("references", "References", ref,
      "Add people who can vouch for your work.", "references", rows("references").length));

    var hero = out[0];

    var filledCards = rvCards.filter(function (c) { return c.filled; })
                             .map(function (c) { return c.html; }).join("");
    var emptyCards = rvCards.filter(function (c) { return !c.filled; })
                            .map(function (c) { return c.html; }).join("");

    var gaps = rvGaps.length
      ? '<div class="rv-gaps">' +
          '<span class="rv-gaps-k">Still missing</span>' +
          '<span class="rv-gaps-v">' + esc(rvGaps.join(" \u00b7 ")) + "</span>" +
        "</div>"
      : "";

    // Anything filled in stacks at the top; the rest waits below its own rule.
    var todo = emptyCards
      ? '<div class="rv-divider"><span>' +
          (filledCards ? "Not added yet" : "Start anywhere") +
        "</span></div>" + emptyCards
      : "";

    return hero + gaps + filledCards + todo;
  }

  function renderReview() {
    if (!el.reviewBody) return;
    el.reviewBody.innerHTML = buildReview();

    /* The progress ring, photo editor and completion tick are real, wired
       elements — move them into the freshly built hero rather than recreating
       them, so every listener and the SVG filters survive. */
    var slot = el.reviewBody.querySelector(".rv-media-slot");
    if (slot && el.identityMedia) {
      el.identityMedia.hidden = false;
      slot.appendChild(el.identityMedia);
    }

    var done = profileSections.filter(function (s) { return s.completed; }).length;
    var pct = Math.round((done / TOTAL) * 100);
    if (el.reviewPct) el.reviewPct.textContent = pct + "%";
    if (el.reviewSub) {
      el.reviewSub.textContent = pct === 100
        ? "Every section is done. This is your profile as a recruiter sees it."
        : done + " of " + TOTAL + " sections saved \u2014 this updates as you go.";
    }
  }

  /* ----------------------------------------------------------
     12a-ii. The section form lives in a slide-over.
     The report card is the page; opening a card's Add / Edit slides the
     matching form in from the right.
     ---------------------------------------------------------- */
  function formOpen() {
    return el.formSheet && !el.formSheet.hidden;
  }

  function openForm(i, startEditing) {
    if (!el.formSheet || !el.formScrim) return;
    if (typeof i === "number" && i >= 0 && i < TOTAL) {
      if (i !== state.currentSectionIndex) {
        persistCurrentValues();
        state.currentSectionIndex = i;
        saveState();
      }
      renderSection();
    }
    if (startEditing) enterEditMode();

    el.formScrim.hidden = false;
    el.formSheet.hidden = false;
    requestAnimationFrame(function () {
      el.formScrim.classList.add("show");
      el.formSheet.classList.add("show");
      fitBody();
    });
    document.body.classList.add("form-open");
  }

  function closeForm() {
    if (!formOpen()) return;
    persistCurrentValues();
    el.formScrim.classList.remove("show");
    el.formSheet.classList.remove("show");
    document.body.classList.remove("form-open");
    setTimeout(function () {
      el.formScrim.hidden = true;
      el.formSheet.hidden = true;
    }, 240);
    renderReview();
  }

  /* ----------------------------------------------------------
     12b. Testing helpers — "Refill Complete Form" / "Reset"
     ---------------------------------------------------------- */
  var SAMPLE_DATA = {
    basic: {
      firstName: "Shallika",
      middleName: "",
      lastName: "Seth",
      countryCode: "IN",
      phone: "+91-7081441088",
      city: "Noida",
      state: "Uttar Pradesh",
      languages: ["English", "Hindi"],
      headline: "UI/UX Designer crafting calm, usable product interfaces",
      resume: { name: "Shallika-Seth-Resume.pdf", size: 284160 },
      about: "I am a creative and curious individual, which keeps me open minded and excited to understand things better. I have been passionate about design and art from a very young age. I believe in progress instead of perfection, and that has been my motto. I work well both on my own and within a team, and I enjoy turning messy problems into clear, usable interfaces."
    },
    experience: [
      {
        company: "Zunno AI", role: "UI/UX Designer", employmentType: "Internship",
        location: "Gurugram", current: false,
        start: { month: "7", year: "2025" }, end: { month: "12", year: "2025" },
        description: "Owned the design of the onboarding and billing flows end to end. Shipped a component library that cut new-screen build time roughly in half, and ran usability sessions that lifted activation."
      },
      {
        company: "Bigbets Studio", role: "Product Design Intern", employmentType: "Freelance",
        location: "Remote", current: false,
        start: { month: "1", year: "2025" }, end: { month: "6", year: "2025" },
        description: "Redesigned the marketing site and design system tokens for three client brands."
      }
    ],
    education: [
      {
        school: "Banasthali Vidyapith", degree: "B.Tech / B.E.",
        department: "Computer Science and Engineering", current: false,
        start: { month: "7", year: "2022" }, end: { month: "5", year: "2026" },
        scoreType: "CGPA_10", score: "7.9",
        description: "Coursework in HCI, data structures and design systems. Led the campus design society for two years."
      }
    ],
    projects: [
      {
        name: "Mahrea",
        description: "A marketplace for independent makers. I built the catalogue, the checkout flow and the seller dashboard, and the hard part was keeping inventory consistent across concurrent orders.",
        techStack: ["Next.js", "Postgres", "Tailwind"],
        github: "https://github.com/shallika/mahrea",
        liveUrl: "https://www.mahrea.com/"
      }
    ],
    mock: {},
    skills: {
      skills: ["Python", "React", "HTML", "CSS", "JavaScript", "Figma"]
    },
    certifications: [
      {
        name: "UX Design", issuer: "Google",
        issued: { month: "12", year: "2025" }, expires: { month: "", year: "" },
        credentialUrl: "https://www.credly.com/badges/a5639597-9e09-411b-b0b4-f9fb56305b51/linked_in_profile"
      }
    ],
    links: {
      linkedin: "https://www.linkedin.com/in/shallika-seth-740498255/",
      github: "https://github.com/shallika",
      portfolio: "https://shallikasethdesigns.vercel.app/index.html",
      resume: "https://drive.google.com/file/d/1a2b3c4d5e/view"
    },
    career: {
      openToWork: true,
      preferredRoles: ["Product Designer", "Frontend Engineer"],
      preferredLocations: ["Bangalore", "Remote"],
      opportunityType: ["Full-time"],
      workMode: "Hybrid",
      noticePeriod: "10",
      availableFrom: { month: "1", year: "2026" },
      willingToRelocate: true
    },
    references: [
      {
        name: "Ananya Rao", relationship: "Design Manager at Zunno AI",
        email: "ananya.rao@zunno.ai", phone: "+91-9810045512",
        note: "Managed me directly through the onboarding redesign. Happy to speak to process and collaboration."
      }
    ]
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Fills every section with sample data, marks the profile complete and
     plays the full completion sequence — the whole flow in one click. */
  function refillCompleteForm() {
    state.values = clone(SAMPLE_DATA);
    profileSections.forEach(function (s) {
      s.completed = true;
      state.completed[s.id] = true;
    });
    state.currentSectionIndex = TOTAL - 1;
    state.celebrated = true;
    saveState();

    renderSection();
    updateProfileCompletion();
    runCompletionCelebration();
  }

  /* Clears everything and returns to the initial (white header) state. */
  function resetForm() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PHOTO_KEY);
    } catch (e) { /* ignore */ }
    Array.prototype.forEach.call(document.querySelectorAll(".avatar"), function (n) {
      n.style.backgroundImage = "";
    });

    state.values = {};
    state.completed = {};
    state.currentSectionIndex = 0;
    state.celebrated = false;
    profileSections.forEach(function (s) { s.completed = false; });

    el.progress.classList.remove("finished");
    el.progress.style.background = "";
    el.progress.style.boxShadow = "";
    el.ringWrap.classList.remove("celebrate");

    saveState();
    renderSection();
    updateProfileCompletion();
  }

  /* ----------------------------------------------------------
     12c. Profile photo — the pencil on the avatar
     ---------------------------------------------------------- */
  var PHOTO_KEY = "studentProfilePhoto";
  var PHOTO_BOX = 240;                  // stored square, keeps localStorage small

  function applyPhoto(dataUrl) {
    if (!dataUrl) return;
    Array.prototype.forEach.call(document.querySelectorAll(".avatar"), function (n) {
      n.style.backgroundImage = "url(" + dataUrl + ")";
    });
  }

  function loadPhoto() {
    try { applyPhoto(localStorage.getItem(PHOTO_KEY)); } catch (e) { /* ignore */ }
  }

  /* Downscale to a 240px square before storing — a full-size photo would
     blow the localStorage quota. */
  function handlePhotoFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var side = Math.min(img.width, img.height);
        var sx = (img.width - side) / 2;
        var sy = (img.height - side) / 2;

        var canvas = document.createElement("canvas");
        canvas.width = canvas.height = PHOTO_BOX;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_BOX, PHOTO_BOX);

        var out = canvas.toDataURL("image/jpeg", 0.85);
        applyPhoto(out);
        try { localStorage.setItem(PHOTO_KEY, out); } catch (e) { /* quota — keep it in the page */ }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  if (el.avatarEdit && el.photoInput) {
    el.avatarEdit.addEventListener("click", function () { el.photoInput.click(); });
    el.photoInput.addEventListener("change", function () {
      handlePhotoFile(el.photoInput.files && el.photoInput.files[0]);
      el.photoInput.value = "";
    });
  }

  /* ----------------------------------------------------------
     13. Mobile sidebar
     ---------------------------------------------------------- */
  function closeSidebar() {
    el.sidebar.classList.remove("open");
    el.scrim.classList.remove("show");
  }
  el.menuBtn.addEventListener("click", function () {
    var open = el.sidebar.classList.toggle("open");
    el.scrim.classList.toggle("show", open);
  });
  el.scrim.addEventListener("click", closeSidebar);

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitBody, 120);
  });

  /* ----------------------------------------------------------
     14. Boot
     ---------------------------------------------------------- */
  /* index.html loads flags.js and data.js before this file. If either is
     missing the page still runs, but flags and the state / degree lists are
     empty — say so loudly rather than failing silently. */
  if (!window.AB_FLAGS) {
    console.error("AB Talks: flags.js did not load — country flags will be missing. " +
                  "Keep index.html, style.css, script.js, flags.js and data.js in the same folder.");
  }
  if (!window.AB_STATES || !window.AB_DEGREES) {
    console.error("AB Talks: data.js did not load — the State, Degree and Specialization " +
                  "dropdowns will be empty. Keep all five files in the same folder.");
  }

  el.nextBtn.addEventListener("click", handlePrimary);
  el.prevBtn.addEventListener("click", handlePrev);
  if (el.refillBtn) el.refillBtn.addEventListener("click", refillCompleteForm);
  /* Any control that another field depends on rebuilds its dependants. */
  el.body.addEventListener("change", function (e) {
    var node = e.target;
    var name = node && node.dataset ? node.dataset.name : null;
    if (!name) return;

    var section = profileSections[state.currentSectionIndex];
    if (!section.fields.some(function (f) { return f.dependsOn === name; })) return;

    var entry = node.closest(".entry");
    var scope = entry || el.body;
    var index = entry
      ? Array.prototype.indexOf.call(entry.parentNode.children, entry)
      : 0;

    refreshDependents(section, scope, name, index);
    persistCurrentValues();
  });

  /* ---- Review Profile ---- */
  if (el.formClose) el.formClose.addEventListener("click", closeForm);
  if (el.formScrim) el.formScrim.addEventListener("click", closeForm);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !formOpen()) return;
    // an open dropdown swallows the first Escape (openPicker preventDefaults it)
    if (e.defaultPrevented || document.querySelector(".pick-menu")) return;
    closeForm();
  });
  // "Add" / "Edit" on a report-card row slides that section's form in
  if (el.reviewBody) el.reviewBody.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-goto]");
    if (!btn) return;
    var i = parseInt(btn.dataset.goto, 10);
    if (isNaN(i) || i < 0) return;
    openForm(i, true);
  });

  if (el.editBtn) el.editBtn.addEventListener("click", enterEditMode);
  if (el.resetBtn) el.resetBtn.addEventListener("click", resetForm);
  window.addEventListener("beforeunload", persistCurrentValues);

  loadState();
  loadPhoto();

  /* The report card is the landing view, so it always starts at the top of the
     profile rather than wherever the last session left off. */
  state.currentSectionIndex = 0;
  state.editing = false;

  renderSection();
  renderReview();          // draw the report card on first paint

  // animate the ring in from 0 on first paint
  updateCircularProgress(0);
  updateCompletionBadge(0);
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var pct = updateProfileCompletion();
      if (pct === 100 && state.celebrated) applyCompletedVisualState();
    });
  });
})();
