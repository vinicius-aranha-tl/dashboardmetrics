/** Auditoria local, somente leitura: separa indícios de status de cobertura de contrato comprovada. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function argumentsOf(args) {
  const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const result = { candidates: value("--candidates"), openapi: value("--openapi"), repo: value("--repo"), output: value("--output") };
  if (Object.values(result).some((entry) => !entry)) throw new Error("Informe --candidates, --openapi, --repo e --output.");
  return result;
}

function statusAssertions(node, expected) {
  let found = false;
  const visit = (current) => {
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression) && current.expression.name.text === "toBe" && current.arguments[0]?.getText() === String(expected)) {
      const expect = current.expression.expression;
      if (ts.isCallExpression(expect) && ts.isIdentifier(expect.expression) && expect.expression.text === "expect") {
        const input = expect.arguments[0];
        if (input && ts.isCallExpression(input) && ts.isPropertyAccessExpression(input.expression) && input.expression.name.text === "status") found = true;
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function findTest(source, title, status) {
  const ast = ts.createSourceFile("spec.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let result = null;
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "test" && node.arguments.length >= 2 && ts.isStringLiteralLike(node.arguments[0]) && node.arguments[0].text === title) {
      result = { line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, explicitStatusAssertion: statusAssertions(node.arguments[1], status) };
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return result;
}

export async function auditEvidence({ candidates, openapi, repo }) {
  const document = JSON.parse(await readFile(openapi, "utf8"));
  const input = JSON.parse(await readFile(candidates, "utf8"));
  if (!Array.isArray(input.evidence) || !document.paths) throw new Error("Formato do inventário ou das evidências inválido.");
  const root = path.resolve(repo);
  const files = new Map();
  const results = [];
  for (const item of input.evidence) {
    const relative = String(item.testFile ?? "").split(/[\\/]/).join(path.sep);
    const file = path.resolve(root, relative);
    if (!relative || !file.startsWith(root + path.sep)) throw new Error("Arquivo de teste fora do repositório permitido.");
    if (!files.has(file)) files.set(file, await readFile(file, "utf8"));
    const title = `${item.scenario} - HTTP ${item.status}`;
    const test = findTest(files.get(file), title, item.status);
    const response = document.paths?.[item.path]?.[String(item.method).toLowerCase()]?.responses?.[String(item.status)];
    const schema = response?.content?.[item.contentType]?.schema;
    const documentedResponse = Boolean(response);
    results.push({ method: item.method, path: item.path, status: String(item.status), contentType: item.contentType, documentedResponse, declaredType: schema?.["x-csharp-type"] ?? schema?.["$ref"] ?? null, testFile: relative.split(path.sep).join("/"), scenario: item.scenario, testLine: test?.line ?? null, explicitStatusAssertion: test?.explicitStatusAssertion ?? false, contractVerified: false, state: !documentedResponse ? "response-not-in-document" : test?.explicitStatusAssertion ? "status-confirmed-contract-unverified" : "manual-review" });
  }
  return { schemaVersion: 1, description: "Análise estática preliminar. Status, rota e nome do tipo não comprovam validação integral do contrato ou Swagger executado.", counts: { candidates: results.length, explicitStatusAssertions: results.filter(r => r.explicitStatusAssertion).length, contractVerified: 0, manualReview: results.filter(r => !r.explicitStatusAssertion).length }, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = argumentsOf(process.argv.slice(2));
    const result = await auditEvidence(options);
    await writeFile(options.output, JSON.stringify(result, null, 2) + "\n", "utf8");
    console.log(`Candidatas: ${result.counts.candidates}; status com asserção explícita: ${result.counts.explicitStatusAssertions}; contratos integralmente comprovados: ${result.counts.contractVerified}.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
