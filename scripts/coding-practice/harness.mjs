// Builds starter code and the hidden harness (prefix + driver) for one
// question in every language, from its typed signature. Used only by the
// content generators in this folder; nothing at runtime imports it.
//
// Stdin convention: one JSON value per argument, one per line. The driver
// prints the return value as compact JSON. Strings in tests must not contain
// a double quote or a backslash (the Java and C++ drivers do not unescape).

/** @typedef {"int"|"bool"|"string"|"int[]"|"int[][]"|"intlists"|"string[]"|"string[][]"} T */

const TYPES = {
  int: { py: "int", java: "int", cpp: "int", js: "number" },
  bool: { py: "bool", java: "boolean", cpp: "bool", js: "boolean" },
  string: { py: "str", java: "String", cpp: "string", js: "string" },
  "int[]": { py: "List[int]", java: "int[]", cpp: "vector<int>", js: "number[]" },
  "int[][]": { py: "List[List[int]]", java: "int[][]", cpp: "vector<vector<int>>", js: "number[][]" },
  // Same wire format as int[][]; Java uses lists because the row count is unknown.
  intlists: { py: "List[List[int]]", java: "List<List<Integer>>", cpp: "vector<vector<int>>", js: "number[][]" },
  "string[]": { py: "List[str]", java: "String[]", cpp: "vector<string>", js: "string[]" },
  "string[][]": { py: "List[List[str]]", java: "List<List<String>>", cpp: "vector<vector<string>>", js: "string[][]" },
};

const JAVA_DEFAULT = {
  int: "0",
  bool: "false",
  string: '""',
  "int[]": "new int[0]",
  "int[][]": "new int[0][0]",
  intlists: "new ArrayList<>()",
  "string[][]": "new ArrayList<>()",
};
const CPP_DEFAULT = { int: "0", bool: "false", string: '""' };

const JAVA_PREFIX = "import java.util.*;\nimport java.io.*;\n";
const CPP_PREFIX = "#include <bits/stdc++.h>\nusing namespace std;\n";
const PY_PREFIX = "from typing import List, Optional\n";

const JAVA_HELPERS = String.raw`
    static int[] pIntArr(String line) {
        String s = line.trim();
        s = s.substring(1, s.length() - 1).trim();
        if (s.isEmpty()) return new int[0];
        String[] parts = s.split(",");
        int[] out = new int[parts.length];
        for (int i = 0; i < parts.length; i++) out[i] = Integer.parseInt(parts[i].trim());
        return out;
    }

    static int[][] pIntMat(String line) {
        List<int[]> rows = new ArrayList<>();
        int depth = 0;
        StringBuilder cur = null;
        for (char c : line.toCharArray()) {
            if (c == '[') {
                depth++;
                if (depth == 2) cur = new StringBuilder();
            } else if (c == ']') {
                if (depth == 2) rows.add(pIntArr("[" + cur + "]"));
                depth--;
            } else if (depth == 2) {
                cur.append(c);
            }
        }
        return rows.toArray(new int[0][]);
    }

    static String pStr(String line) {
        int a = line.indexOf('"');
        int b = line.lastIndexOf('"');
        return line.substring(a + 1, b);
    }

    static String[] pStrArr(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = null;
        for (char c : line.toCharArray()) {
            if (c == '"') {
                if (cur == null) {
                    cur = new StringBuilder();
                } else {
                    out.add(cur.toString());
                    cur = null;
                }
            } else if (cur != null) {
                cur.append(c);
            }
        }
        return out.toArray(new String[0]);
    }

    static String fInts(int[] a) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < a.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(a[i]);
        }
        return sb.append(']').toString();
    }

    static List<List<Integer>> toLists(int[][] m) {
        List<List<Integer>> out = new ArrayList<>();
        for (int[] row : m) {
            List<Integer> r = new ArrayList<>();
            for (int x : row) r.add(x);
            out.add(r);
        }
        return out;
    }

    static <T> String fLists(List<List<T>> a, boolean quote) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < a.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append('[');
            List<T> row = a.get(i);
            for (int j = 0; j < row.size(); j++) {
                if (j > 0) sb.append(',');
                if (quote) sb.append('"').append(row.get(j)).append('"');
                else sb.append(row.get(j));
            }
            sb.append(']');
        }
        return sb.append(']').toString();
    }

    static <T extends Comparable<T>> int cmpList(List<T> a, List<T> b) {
        for (int i = 0; i < Math.min(a.size(), b.size()); i++) {
            int c = a.get(i).compareTo(b.get(i));
            if (c != 0) return c;
        }
        return Integer.compare(a.size(), b.size());
    }

    static <T extends Comparable<T>> List<List<T>> norm(List<List<T>> a) {
        List<List<T>> out = new ArrayList<>();
        for (List<T> x : a) {
            List<T> y = new ArrayList<>(x);
            Collections.sort(y);
            out.add(y);
        }
        out.sort((p, q) -> cmpList(p, q));
        return out;
    }
`;

const CPP_HELPERS = String.raw`
static vector<int> pIntArr(const string& line) {
    vector<int> out;
    string num;
    for (char c : line) {
        if (c == '-' || isdigit(static_cast<unsigned char>(c))) {
            num += c;
        } else if (!num.empty()) {
            out.push_back(stoi(num));
            num.clear();
        }
    }
    if (!num.empty()) out.push_back(stoi(num));
    return out;
}

static vector<vector<int>> pIntMat(const string& line) {
    vector<vector<int>> rows;
    int depth = 0;
    string cur;
    for (char c : line) {
        if (c == '[') {
            depth++;
            if (depth == 2) cur.clear();
        } else if (c == ']') {
            if (depth == 2) rows.push_back(pIntArr(cur));
            depth--;
        } else if (depth == 2) {
            cur += c;
        }
    }
    return rows;
}

static string pStr(const string& line) {
    size_t a = line.find('"');
    size_t b = line.rfind('"');
    return line.substr(a + 1, b - a - 1);
}

static vector<string> pStrArr(const string& line) {
    vector<string> out;
    string cur;
    bool in = false;
    for (char c : line) {
        if (c == '"') {
            if (in) out.push_back(cur);
            cur.clear();
            in = !in;
        } else if (in) {
            cur += c;
        }
    }
    return out;
}

static string fmt(int v) { return to_string(v); }
static string fmt(bool v) { return v ? "true" : "false"; }
static string fmt(const string& v) { return "\"" + v + "\""; }
static string fmt(const vector<int>& a) {
    string s = "[";
    for (size_t i = 0; i < a.size(); i++) {
        if (i) s += ",";
        s += to_string(a[i]);
    }
    return s + "]";
}
static string fmt(const vector<vector<int>>& a) {
    string s = "[";
    for (size_t i = 0; i < a.size(); i++) {
        if (i) s += ",";
        s += fmt(a[i]);
    }
    return s + "]";
}
static string fmt(const vector<vector<string>>& a) {
    string s = "[";
    for (size_t i = 0; i < a.size(); i++) {
        if (i) s += ",";
        s += "[";
        for (size_t j = 0; j < a[i].size(); j++) {
            if (j) s += ",";
            s += "\"" + a[i][j] + "\"";
        }
        s += "]";
    }
    return s + "]";
}
`;

const JAVA_PARSE = {
  int: (i) => `Integer.parseInt(L.get(${i}).trim())`,
  "int[]": (i) => `pIntArr(L.get(${i}))`,
  "int[][]": (i) => `pIntMat(L.get(${i}))`,
  string: (i) => `pStr(L.get(${i}))`,
  "string[]": (i) => `pStrArr(L.get(${i}))`,
};
const CPP_PARSE = {
  int: (i) => `stoi(L[${i}])`,
  "int[]": (i) => `pIntArr(L[${i}])`,
  "int[][]": (i) => `pIntMat(L[${i}])`,
  string: (i) => `pStr(L[${i}])`,
  "string[]": (i) => `pStrArr(L[${i}])`,
};

function javaPrint(ret, sorted) {
  switch (ret) {
    case "int":
    case "bool":
      return "String.valueOf(out)";
    case "string":
      return '"\\"" + out + "\\""';
    case "int[]":
      return "fInts(out)";
    case "int[][]":
      return sorted ? "fLists(norm(toLists(out)), false)" : "fLists(toLists(out), false)";
    case "intlists":
      return sorted ? "fLists(norm(out), false)" : "fLists(out, false)";
    case "string[][]":
      return sorted ? "fLists(norm(out), true)" : "fLists(out, true)";
    default:
      throw new Error(`no Java printer for ${ret}`);
  }
}

/**
 * @param {{ fn: string, params: { name: string, type: T }[], ret: T, sortOutput?: boolean }} q
 * `sortOutput`: the answer may be returned in any order, so the driver sorts
 * each inner list and then the outer list before printing.
 */
export function buildHarness(q) {
  const { fn, params, ret, sortOutput = false } = q;
  const t = (type, lang) => TYPES[type][lang];

  // ── Python ──
  const pyArgs = params.map((p) => `${p.name}: ${t(p.type, "py")}`).join(", ");
  const pyStarter = `class Solution:\n    def ${fn}(self, ${pyArgs}) -> ${t(ret, "py")}:\n        # Write your code here\n        pass\n`;
  const pyDriver = [
    "",
    'if __name__ == "__main__":',
    "    import sys, json",
    '    _args = [json.loads(_l) for _l in sys.stdin.read().split("\\n") if _l.strip() != ""]',
    `    _out = Solution().${fn}(*_args)`,
    ...(sortOutput
      ? ["    if isinstance(_out, list):", "        _out = sorted(sorted(_x) for _x in _out)"]
      : []),
    '    print(json.dumps(_out, separators=(",", ":")))',
    "",
  ].join("\n");

  // ── JavaScript ──
  const jsDoc = [
    "/**",
    ...params.map((p) => ` * @param {${t(p.type, "js")}} ${p.name}`),
    ` * @return {${t(ret, "js")}}`,
    " */",
  ].join("\n");
  const jsStarter = `${jsDoc}\nfunction ${fn}(${params.map((p) => p.name).join(", ")}) {\n  // Write your code here\n}\n`;
  const jsDriver = [
    "",
    'const _args = require("fs").readFileSync(0, "utf8").split("\\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l));',
    `let _out = ${fn}(..._args);`,
    ...(sortOutput
      ? [
          "if (Array.isArray(_out)) {",
          "  const _cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);",
          "  _out = _out.map((x) => [...x].sort(_cmp)).sort((a, b) => {",
          "    for (let i = 0; i < Math.min(a.length, b.length); i++) {",
          "      const c = _cmp(a[i], b[i]);",
          "      if (c !== 0) return c;",
          "    }",
          "    return a.length - b.length;",
          "  });",
          "}",
        ]
      : []),
    "console.log(JSON.stringify(_out));",
    "",
  ].join("\n");

  // ── Java ──
  const javaArgs = params.map((p) => `${t(p.type, "java")} ${p.name}`).join(", ");
  const javaStarter = `class Solution {\n    public ${t(ret, "java")} ${fn}(${javaArgs}) {\n        // Write your code here\n        return ${JAVA_DEFAULT[ret]};\n    }\n}\n`;
  const javaDriver = [
    "",
    "public class Main {" + JAVA_HELPERS,
    "    public static void main(String[] args) throws IOException {",
    "        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));",
    "        List<String> L = new ArrayList<>();",
    "        String line;",
    "        while ((line = br.readLine()) != null) {",
    "            if (!line.trim().isEmpty()) L.add(line);",
    "        }",
    ...params.map((p, i) => `        ${t(p.type, "java")} a${i} = ${JAVA_PARSE[p.type](i)};`),
    `        ${t(ret, "java")} out = new Solution().${fn}(${params.map((_, i) => `a${i}`).join(", ")});`,
    `        System.out.println(${javaPrint(ret, sortOutput)});`,
    "    }",
    "}",
    "",
  ].join("\n");

  // ── C++ ──
  const cppArgs = params
    .map((p) => {
      const ty = t(p.type, "cpp");
      return ty.startsWith("vector") ? `${ty}& ${p.name}` : `${ty} ${p.name}`;
    })
    .join(", ");
  const cppStarter = `class Solution {\npublic:\n    ${t(ret, "cpp")} ${fn}(${cppArgs}) {\n        // Write your code here\n        return ${CPP_DEFAULT[ret] ?? "{}"};\n    }\n};\n`;
  const cppDriver = [
    CPP_HELPERS,
    "int main() {",
    "    vector<string> L;",
    "    string line;",
    "    while (getline(cin, line)) {",
    "        if (!line.empty() && line.back() == '\\r') line.pop_back();",
    '        if (line.find_first_not_of(" \\t") != string::npos) L.push_back(line);',
    "    }",
    ...params.map((p, i) => `    ${t(p.type, "cpp")} a${i} = ${CPP_PARSE[p.type](i)};`),
    `    ${t(ret, "cpp")} out = Solution().${fn}(${params.map((_, i) => `a${i}`).join(", ")});`,
    ...(sortOutput
      ? ["    for (auto& x : out) sort(x.begin(), x.end());", "    sort(out.begin(), out.end());"]
      : []),
    '    cout << fmt(out) << "\\n";',
    "    return 0;",
    "}",
    "",
  ].join("\n");

  return {
    starterCode: { python: pyStarter, java: javaStarter, cpp: cppStarter, javascript: jsStarter },
    harness: {
      python: { prefix: PY_PREFIX, driver: pyDriver },
      java: { prefix: JAVA_PREFIX, driver: javaDriver },
      cpp: { prefix: CPP_PREFIX, driver: cppDriver },
      javascript: { prefix: "", driver: jsDriver },
    },
  };
}

/** Same ordering the drivers apply when `sortOutput` is set. */
export function sortLists(lists) {
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return lists
    .map((x) => [...x].sort(cmp))
    .sort((a, b) => {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const c = cmp(a[i], b[i]);
        if (c !== 0) return c;
      }
      return a.length - b.length;
    });
}
