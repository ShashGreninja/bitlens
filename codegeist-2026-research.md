# Codegeist 2026 research and entry guide

Checked November 23, 2026. The problem references are grouped by the official prize categories. Atlassian issue statuses reflect the public tracker at the time of review. Each survey, audit, experiment, and incident report describes the people or cases it examined. [Codegeist 2026 categories](https://codegeist2026.devpost.com/)

## Documented problems

### Apps for Software Teams

#### Pull-request reviewers have to leave the review to see test outcomes

**Unresolved Bitbucket Cloud suggestion.** The reporter describes reviewers having to open the associated pipeline build or Tests tab to see how many tests passed, failed, or were skipped. The issue concerns test-result details for the build associated with the pull request. Atlassian’s Pipelines documentation shows where those results are available. [BCLOUD-24105](https://jira.atlassian.com/browse/BCLOUD-24105) · [Bitbucket Pipelines test reporting](https://support.atlassian.com/bitbucket-cloud/docs/test-reporting-in-pipelines/)

#### Team-managed Jira boards lack visibility into work in other projects

**Unresolved Jira Cloud suggestion.** Teams want to see work from other projects in a team-managed backlog or board. Atlassian’s response describes the planning and tracking gap and points to company-managed projects for teams that need a cross-project board. [JRACLOUD-85680](https://jira.atlassian.com/browse/JRACLOUD-85680)

#### Developers lose time finding information and waiting for feedback

**Separate developer surveys.** Atlassian’s 2026 study ranked finding information highest among reported sources of developer friction, followed by meetings, context switching, technical debt, and unclear requirements. In a separate 2023 GitHub survey of 500 U.S. enterprise developers, respondents reported waiting for code reviews, builds and tests, and spending about as much time waiting for builds and tests as they spent writing new code. [Atlassian 2026 State of Developer Experience findings](https://www.atlassian.com/blog/development/developer-experience-report-2026) · [GitHub developer experience survey](https://github.blog/news-insights/research/survey-reveals-ais-impact-on-the-developer-experience/)

### Apps for Business Teams

#### An approver’s absence can stall a service request

**Unresolved Jira Service Management Cloud suggestion.** The reporter describes a designated approver going on vacation without a way to delegate their approval rights temporarily. A linked Data Center request gives a concrete example in which business-unit managers are selected from the requester’s directory record. [JSDCLOUD-7867](https://jira.atlassian.com/browse/JSDCLOUD-7867) · [Business-unit manager example](https://jira.atlassian.com/browse/JSDSERVER-5121)

#### Page-approval changes do not trigger Confluence Automation rules

**Unresolved Confluence Cloud suggestion.** Teams can formally sign off on policies, launch plans, and other documents through Confluence Approvals. The issue records that starting a review or reaching approval does not fire the standard page-status automation trigger. It describes cases where teams need to coordinate a page approval with work in a linked Jira ticket. Native Confluence Approvals are a Premium and Enterprise feature, according to Atlassian’s support docs. [CONFCLOUD-85157](https://jira.atlassian.com/browse/CONFCLOUD-85157) · [Confluence approval documentation](https://support.atlassian.com/confluence-cloud/docs/request-and-manage-approvals-in-confluence/)

#### Procurement teams struggle to complete and document quality checks

**2025 U.S. Government Accountability Office audit.** Of 70 federal agencies that submitted procurement data for fiscal year 2023, 36 confirmed completing an annual data-quality report. GAO found that 19 of 24 reviewed reports missed the submission deadline and that three of five selected agencies did not adequately develop or document corrective actions for identified issues. [GAO procurement data quality audit](https://www.gao.gov/products/gao-25-107469)

#### Staff report spending too much time searching for work information

**2023 cross-industry survey.** Microsoft surveyed 31,000 people across 31 countries. Sixty-two percent of respondents reported spending too much time searching for information during their workday. The result captures employees’ reported experience across the survey. [Microsoft Work Trend Index](https://www.microsoft.com/en-us/worklab/work-trend-index/will-ai-fix-work)

### Apps for Specialized Industries

#### Manufacturing records are hard to trace from design through inspection

**NIST engineering experiment.** Researchers tested open data standards in a small model-based manufacturing environment. They could not fully link the required information across engineering design, production, and final inspection. The study documents the gaps they encountered while trying to trace those stages. [NIST design, manufacturing, and inspection study](https://www.nist.gov/publications/defining-requirements-integrating-information-between-design-manufacturing-and) · [NIST manufacturing supply-chain roadmap](https://www.nist.gov/publications/roadmap-strengthen-us-manufacturing-supply-chain-digital-thread-technology)

#### Aircraft maintenance status can be misread at shift handover

**NASA Aviation Safety Reporting System case.** A captain reported that work cards in the aircraft logbook made a required pre-departure check look complete. A maintenance technician reported that its final steps were unassigned and that the incoming shift did not receive enough status detail before the aircraft departed. NASA published the two accounts under “Logbook, Legality, and ETOPS.” [NASA ASRS CALLBACK, issue 501](https://asrs.arc.nasa.gov/publications/callback/cb_501.html)

#### Health insurance reviewers can miss evidence already present in case records

**2022 U.S. Department of Health and Human Services Inspector General review.** From a stratified sample of 250 prior-authorization denials issued by 15 large Medicare Advantage organizations during one week in 2019, the Inspector General estimated that 13% of denied requests met Medicare coverage rules. In some cases cited as missing documentation, reviewers found the existing records sufficient. [HHS OIG prior-authorization denial review](https://oig.hhs.gov/reports/all/2022/some-medicare-advantage-organization-denials-of-prior-authorization-requests-raise-concerns-about-beneficiary-access-to-medically-necessary-care/)

## Requirements and technology

### Deadline and eligibility

Registration and submissions are open. Both close on **Tuesday, December 22, 2026 at 12:00 p.m. Pacific Standard Time**, which is **Wednesday, December 23, 2026 at 1:30 a.m. IST**. Judging runs January 5 through February 3, 2027. Winners are expected around February 15, 2027. [Official rules](https://codegeist2026.devpost.com/rules) · [Devpost schedule](https://codegeist2026.devpost.com/details/dates)

You can enter individually, as a team, or as an organization. Individuals must meet the age of majority where they live. Teams and organizations appoint one eligible representative. Residence and conflict-of-interest restrictions apply. Multiple entries are allowed when they are substantially different. [Official rules](https://codegeist2026.devpost.com/rules)

### What every track requires

1. Register on Devpost and sign up for a free Atlassian Cloud Developer License. [Codegeist on Devpost](https://codegeist2026.devpost.com/) · [Atlassian Cloud developer resources](https://developer.atlassian.com/cloud/)
2. Build a working **Atlassian Forge app** that integrates with at least one of **Jira, Confluence, Jira Service Management, Bitbucket, Teamwork Graph, or Rovo**. [Official rules](https://codegeist2026.devpost.com/rules) · [Forge overview](https://developer.atlassian.com/platform/forge/introduction/the-forge-platform/)
3. Enter one main category. The three categories share the same baseline stack. Rovo, an LLM, MCP, Teamwork Graph, and Marketplace publishing are optional for a main-category entry. [Official rules](https://codegeist2026.devpost.com/rules)
4. Submit original work. A new project must have been unpublished before the submission period. If reusing an existing project, update or rebuild it on Forge after the submission period began on October 27, 2026, and include a Forge manifest and at least one Forge module. Use third-party SDKs, APIs, and data under the applicable terms and licenses. [Official rules](https://codegeist2026.devpost.com/rules)

| Main category | Intended users | Forge resources relevant to the category |
| --- | --- | --- |
| Apps for Software Teams | Developers and software delivery teams | [Jira tutorial](https://developer.atlassian.com/platform/forge/build-a-hello-world-app-in-jira/) · [Bitbucket tutorial](https://developer.atlassian.com/platform/forge/build-a-hello-world-app-in-bitbucket/) |
| Apps for Business Teams | Teams such as marketing, sales, HR, finance, support and legal | [Confluence tutorial](https://developer.atlassian.com/platform/forge/build-a-hello-world-app-in-confluence/) · [Jira Service Management tutorial](https://developer.atlassian.com/platform/forge/build-a-hello-world-app-in-jira-service-management/) |
| Apps for Specialized Industries | Practitioners in an industry such as healthcare, manufacturing or aviation | Any of the six eligible integrations can qualify. [Cloud APIs by product](https://developer.atlassian.com/cloud/) · [Forge tutorials and sample apps](https://developer.atlassian.com/platform/forge/getting-started/) |

### Development tools and resources

- For the official CLI workflow, install a current **Node.js 22 or 24 LTS** and npm, then install the Forge CLI with `npm install -g @forge/cli`. Sign in using `forge login` and an Atlassian scoped API token. The Devpost resources say Node.js 20 or later. The current Forge CLI docs specify minimum versions of 22.23.4 and 24.22.1 for the two supported branches. [Current Forge setup](https://developer.atlassian.com/platform/forge/getting-started/#nodesetup) · [Devpost setup](https://codegeist2026.devpost.com/resources)
- `forge site provision` provides a free 90-day demo development site with seeded data and Jira, Confluence, Jira Service Management, Rovo Enterprise, and Studio. Use `forge create`, `forge deploy`, then `forge install --demo-site` for the standard demo-site workflow. Bitbucket uses `forge install` into a shared Bitbucket team workspace. [Codegeist setup](https://codegeist2026.devpost.com/resources) · [Bitbucket setup](https://developer.atlassian.com/platform/forge/build-a-hello-world-app-in-bitbucket/)
- `manifest.yml` declares modules, permissions, and app configuration. Forge functions use the Node.js runtime. For a UI, modules that support both options can use **UI Kit** with Atlassian React components or **Custom UI** with your own web frontend. Available modules and permissions depend on the integration you select. [Forge manifest](https://developer.atlassian.com/platform/forge/manifest-reference/) · [Node.js runtime](https://developer.atlassian.com/platform/forge/function-reference/nodejs-runtime/) · [UI options](https://developer.atlassian.com/platform/forge/ui-kit/overview/)
- The organizer's resources include product-specific sample apps and a setup walkthrough. The build-session recording covers Forge and Rovo in a live demo. [Official resources and starter examples](https://codegeist2026.devpost.com/resources) · [Getting-started video](https://www.youtube.com/watch?v=uac46B7aXmA) · [Build session recording](https://www.youtube.com/watch?v=6h-utBbScWE) · [Atlassian Developer Community](https://community.developer.atlassian.com/tag/codegeist-2026)

### Optional bonus prizes

| Bonus | Qualification and tools |
| --- | --- |
| Best Agents – Rovo/Assignable agents | Use `rovo:agent` for a native Rovo agent, `rovo:agentConnector` for a remotely hosted agent integrated into Jira, or reusable `rovo:skill` with actions other agents can invoke. Devpost calls the actions `rovo:action`. The actual Forge manifest key is `action`. [Agent](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/) · [Agent connector](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent-connector/) · [Skill](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-skill/) · [Action](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/) |
| Best app with Atlassian MCP | Expose your Forge actions as tools through Atlassian's MCP server with `rovo:mcp`. An open-source `SKILL.md` for third-party agents is optional. [Module reference](https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/) · [MCP tutorial](https://developer.atlassian.com/platform/forge/build-a-hello-world-rovo-mcp/) |
| Best apps with Teamwork Graph integration | Ingest data, query the Graph API, or do both. Ingestion uses `graph:connector` and the `@forge/teamwork-graph` SDK. The GraphQL API is in Preview and requires scopes for the objects you query. The connector terms restrict regulated health and financial data, HR information system data, and other listed data types. [Connector](https://developer.atlassian.com/platform/forge/manifest-reference/modules/teamwork-graph-connector/) · [Query tutorial](https://developer.atlassian.com/platform/teamwork-graph/call-the-teamwork-graph-api/) |
| Best Marketplace published app | Publish or submit for listing, then provide the listing URL or Marketplace review ticket URL. Forge apps submitted for listing or with a license in their manifest cannot use ordinary installation-link sharing. Atlassian documents using a separate unlicensed copy for the judge installation link. [Marketplace submission](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/) · [Forge distribution](https://developer.atlassian.com/platform/forge/distribute-your-apps/) |

Each bonus awards six prizes of US$1,500. A submission can win up to one category prize and one bonus prize. Atlassian’s Forge product manager confirmed that the judging demo sites include Rovo and support Forge LLMs. [Official prize rules](https://codegeist2026.devpost.com/rules) · [Organizer's judging-site clarification](https://community.developer.atlassian.com/t/codegeist-2026-will-judges-test-sites-have-rovo-enabled-and-is-the-forge-llm-module-available-on-them/103823/2)

### What to submit

- **Working installation link.** Deploy to the Forge production environment with `forge deploy -e production`, enable **Sharing** in the Atlassian Developer Console, and include the resulting link on Devpost. Include the test steps, required products, and any configuration or integration setup so judges can run the same workflow shown in the demo on their own site. [Official rules](https://codegeist2026.devpost.com/rules) · [Forge installation link instructions](https://developer.atlassian.com/platform/forge/distribute-your-apps/#start-sharing-your-app)
- **Public YouTube demo under five minutes.** Show the app working and demonstrate the relevant bonus requirements if entering any. Provide the URL in the submission form. [Devpost submission instructions](https://codegeist2026.devpost.com/)
- **Written submission.** Describe the app's functionality and how it uses Forge and the qualifying Atlassian integration. Select the category and any bonus prizes, attach applicable materials, and submit the form before the deadline. Supply all materials in English or include English translations. [Official rules](https://codegeist2026.devpost.com/rules)

Judges first screen for theme and technology fit. Eligible entries are then scored equally on technical implementation, design, potential impact, innovation, and presentation. [Official judging criteria](https://codegeist2026.devpost.com/rules)
