# SparkLend debt accounting tokens on Gnosis

Returns the complete DebtTokenBase-family borrowing-accounting category: variable-debt and historical stable-debt ERC-20 contracts from every identified SparkLend Gnosis reserve in the pinned Messari deployment. Deposit receipts and underlying assets belong to other categories. There is no active-market, balance, supply or output-count filter. Null or zero debt references identify no deployed debt contract. Unknown reserve identities and malformed data throw rather than silently omitting a reserve.

The official Spark deployment repository links https://github.com/marsfoundation/sparklend-v1-core. Its StableDebtToken and VariableDebtToken classes both inherit DebtTokenBase. Public Name Tags use the source token names with an ellipsis only above fifty characters; they contain no generated address suffix. Notes identify the debt mode and historical scope without claiming enabled borrowing or current balances. Stable-debt accounting tokens are not stablecoins.

The source is Spark Lend Gnosis subgraph Bw4RH37UbbGEhHo4FaWwT1dn9QJzm1XSZCyK1cbr6ZKM, deployment QmXCPG1uRf1YhxYmzdr83kQSEoviL4ja2e5JBB4KezvpE9, published in Messari's decentralized deployment catalogue. All pages use one Graph block hash and an advancing ID cursor. The protocol provider is bound to the immutable source manifest.

Build with Yarn and yarn build; test with yarn test. Import returnTags from dist/main.mjs and supply the Graph API key as its second argument. This is a local preparation draft. Complete role/name, current overlap, policy and independent-pair qualification remain required; no filing authority is granted. The previous mixed-category revision remains in Git history.
