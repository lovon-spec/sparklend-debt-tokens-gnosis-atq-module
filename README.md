# SparkLend reserve accounting tokens on Gnosis

Returns SparkLend Gnosis aToken deposit receipts and both variable-debt and historical stable-debt accounting token contracts from positively identified reserves in the Messari source. Underlying assets, zero addresses and unidentified reserve roles are excluded. It does not assert positive balances, active deposits or current borrowing availability. Stable-debt accounting tokens are not stablecoins.

All source pages use the same explicit block hash and a complete unique ID cursor. The protocol provider is bound to the immutable deployment manifest. A pinned-block _meta response may omit its hash only when it reports the initially selected block number; every page still requests that exact block hash.

Source catalogue: https://github.com/messari/subgraphs/blob/master/deployment/decentralized_network_deployments.csv
The already-filed Ethereum single-role modules were read as reference; they are not changed or resubmitted by this draft.

Build with Yarn and yarn build, then import returnTags from dist/main.mjs. The caller supplies a Graph API key. Local unpublished preparation draft; no review or filing authority.
