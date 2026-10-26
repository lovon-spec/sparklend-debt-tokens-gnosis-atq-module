import type { ContractTag, ITagService } from "atq-types";
import fetch from "node-fetch";

// Messari catalogue: https://github.com/messari/subgraphs/blob/master/deployment/decentralized_network_deployments.csv
// Spark Lend Gnosis subgraph Bw4RH37UbbGEhHo4FaWwT1dn9QJzm1XSZCyK1cbr6ZKM.
const deployment = "QmXCPG1uRf1YhxYmzdr83kQSEoviL4ja2e5JBB4KezvpE9";
const endpoint = `https://gateway.thegraph.com/api/deployments/id/${deployment}`;
// Protocol association is bound to the provider in that immutable source manifest.
const provider = "0xa98dacb3fc964a6a0d2ce3b77294241585eaba6d";
type Token = { id: string; name: string; symbol: string };
type Market = { id: string; inputToken: Token; outputToken: Token | null; _vToken: Token | null; _sToken: Token | null; protocol: { id: string } };
type Meta = { deployment: string; hasIndexingErrors: boolean; block: { number: number; hash: string | null } };
const roles: { key: "outputToken" | "_vToken" | "_sToken"; label: string; note: string }[] = [
  { key: "outputToken", label: "aToken", note: "SparkLend aToken deposit-receipt accounting token for supplied underlying assets" },
  { key: "_vToken", label: "Variable Debt", note: "SparkLend non-transferable variable-debt accounting token for variable-rate borrowing balances and accrued interest" },
  { key: "_sToken", label: "Stable Debt", note: "SparkLend historical non-transferable stable-debt accounting token for legacy stable-rate debt bookkeeping; not a stablecoin" },
];
function address(value: string): string {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value) || /^0x0{40}$/i.test(value)) throw new Error("Invalid token or provider address");
  return value.toLowerCase();
}
function plain(value: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 300) throw new Error("Missing token metadata");
  const result = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (/[`\r\n]|\*\*|<[^>]+>|[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(result)) throw new Error("Metadata is not plain text");
  return result;
}
function meta(value: unknown, initial?: Meta): Meta {
  const m = value as Meta;
  if (!m || m.deployment !== deployment || m.hasIndexingErrors !== false || !Number.isSafeInteger(m.block?.number) || m.block.number < 1 ||
      (m.block.hash !== null && !/^0x[0-9a-f]{64}$/i.test(m.block.hash)) || !initial && !m.block.hash ||
      initial && (m.block.number !== initial.block.number || m.block.hash !== null && m.block.hash !== initial.block.hash)) throw new Error("Unknown or inconsistent source block");
  return m;
}
async function query(text: string, apiKey: string): Promise<Record<string, unknown>> {
  const c = new AbortController(), timer = setTimeout(() => c.abort(), 30000);
  try {
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ query: text }), signal: c.signal });
    if (!r.ok) throw new Error("Graph request failed");
    const d = await r.json() as { data?: Record<string, unknown>; errors?: unknown[] };
    if (!d.data || d.errors?.length) throw new Error("Incomplete source response");
    return d.data;
  } finally { clearTimeout(timer); }
}
const service: ITagService = {
  async returnTags(chainId: string, apiKey: string | null): Promise<ContractTag[]> {
    if (chainId !== "100") throw new Error(`Unsupported Chain ID: ${chainId}`);
    if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error("A Graph API key is required");
    const initial = meta((await query("{ _meta { deployment hasIndexingErrors block { number hash } } }", apiKey))._meta);
    const atBlock = `block: { hash: ${JSON.stringify(initial.block.hash)} }`;
    const tags: ContractTag[] = [], seen = new Set<string>(), labels = new Set<string>();
    // Address-valued Bytes IDs have no unique sequential field. Use an ID cursor.
    let cursor = "0x";
    for (;;) {
      const d = await query(`{ _meta(${atBlock}) { deployment hasIndexingErrors block { number hash } }
        markets(first: 1000, orderBy: id, orderDirection: asc, where: { id_gt: ${JSON.stringify(cursor)} }, ${atBlock}) { id protocol { id } inputToken { id name symbol } outputToken { id name symbol } _vToken { id name symbol } _sToken { id name symbol } } }`, apiKey);
      meta(d._meta, initial);
      const rows = d.markets;
      if (!Array.isArray(rows) || rows.length > 1000) throw new Error("Invalid source page");
      for (const market of rows as Market[]) {
        if (typeof market.id !== "string" || market.id <= cursor) throw new Error("Cursor did not advance");
        cursor = market.id;
        if (address(market.protocol?.id) !== provider) throw new Error("Unexpected protocol provider");
        // A market without a positively identified receipt token is not an eligible reserve.
        if (!market.outputToken) continue;
        if (address(market.outputToken.id) !== address(market.id)) throw new Error("Market and receipt identity differ");
        const asset = address(market.inputToken?.id), assetSymbol = plain(market.inputToken?.symbol);
        for (const role of roles) {
          const token = market[role.key];
          if (!token || /^0x0{40}$/i.test(token.id)) continue;
          const contract = address(token.id), tokenName = plain(token.name), tokenSymbol = plain(token.symbol);
          if (contract === asset || seen.has(contract)) throw new Error("Underlying asset or repeated accounting contract");
          seen.add(contract);
          const label = `SparkLend ${assetSymbol.slice(0, 10)} ${role.label} (${contract.slice(2, 12)})`;
          if (labels.has(label)) throw new Error("Ambiguous tag label");
          labels.add(label);
          tags.push({ "Contract Address": `eip155:100:${contract}`, "Public Name Tag": label, "Project Name": "Spark", "UI/Website Link": "https://spark.finance", "Public Note": `${role.note} on Gnosis. Underlying symbol: ${assetSymbol}. Indexed name: ${tokenName}; symbol: ${tokenSymbol}. Includes historical and zero-supply roles; no claim of outstanding balances or enabled deposits/borrowing.` });
        }
      }
      if (rows.length < 1000) break;
    }
    return tags;
  },
};
export async function returnTags(chainId: string, apiKey: string): Promise<ContractTag[]> {
  return service.returnTags(chainId, apiKey);
}
