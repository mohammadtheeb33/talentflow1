// ------------------------------------------------------------------
// Domain Knowledge Base
// Contains dictionaries for synonyms, skill equivalences, and action verbs.
// ------------------------------------------------------------------

export const ACTION_VERBS = [
  // General Impact
  "led", "developed", "created", "managed", "increased", "saved", "reduced",
  "launched", "architected", "designed", "implemented", "optimized", "generated",
  "delivered", "spearheaded", "orchestrated", "engineered", "revamped", "scaled",
  "improved", "initiated", "built", "established",
  
  // Communication
  "negotiated", "presented", "collaborated", "facilitated", "authored", "persuaded",
  "communicated", "liaised", "advocated", "chaired",

  // Leadership
  "mentored", "supervised", "guided", "coached", "directed", "oversaw",
  "recruited", "trained", "empowered", "delegated"
];

// Map for transferable skills (Human Recruiter Logic)
// Key is the specific skill, Value is a list of related/transferable skills
export const TRANSFERABLE_SKILLS: Record<string, string[]> = {
    // General Tech
    "servicenow": ["jira", "bmc", "remedy", "ticketing", "itsm"],
    "aws": ["azure", "gcp", "cloud", "google cloud"],
    "react": ["vue", "angular", "svelte", "frontend", "javascript", "typescript"],
    "node": ["express", "nest", "backend", "javascript", "typescript"],
    "python": ["django", "flask", "fastapi", "pandas", "numpy", "scripting"],
    "sql": ["mysql", "postgres", "database", "oracle", "sql server", "pl/sql", "tsql"],
    "java": ["kotlin", "scala", "c#", "backend", "jvm"],
    "c#": ["java", ".net", "backend", "dotnet"],
    "docker": ["kubernetes", "container", "podman"],
    "kubernetes": ["docker", "container", "orchestration", "openshift", "helm"],

    // DevOps
    "jenkins": ["gitlab ci", "circleci", "travis", "bamboo", "cicd", "ci/cd"],
    "gitlab ci": ["jenkins", "circleci", "github actions", "cicd", "ci/cd"],
    "terraform": ["ansible", "cloudformation", "pulumi", "iac", "infrastructure as code"],
    "ansible": ["terraform", "chef", "puppet", "saltstack", "iac", "automation"],
    
    // Cybersecurity
    "penetration testing": ["ethical hacking", "vulnerability assessment", "security", "pentest"],
    "ethical hacking": ["penetration testing", "security", "white hat"],
    "siem": ["splunk", "alienvault", "qradar", "log analysis", "security monitoring", "soc"],
    "soc": ["siem", "security operations", "incident response", "threat intelligence"],
    
    // Monitoring
    "prometheus": ["grafana", "nagios", "zabbix", "datadog", "monitoring"],
    "grafana": ["prometheus", "kibana", "visualization", "monitoring", "dashboard"],
    "dynatrace": ["datadog", "new relic", "appdynamics", "apm", "monitoring"],
    "datadog": ["dynatrace", "new relic", "splunk", "monitoring", "observability"],
    "splunk": ["elk", "elastic", "logstash", "siem", "monitoring", "logs"]
};

// Role tiers/equivalences
// Key is the canonical role token, Value is a list of synonymous tokens
export const ROLE_EQUIVALENCE: Record<string, string[]> = {
    "engineer": ["developer", "consultant", "specialist", "architect", "technician", "programmer"],
    "developer": ["engineer", "programmer", "coder", "architect", "builder"],
    "manager": ["lead", "head", "director", "supervisor", "vp", "executive"],
    "lead": ["manager", "senior", "principal", "head", "supervisor"],
    "consultant": ["engineer", "advisor", "analyst", "specialist", "contractor"],
    "admin": ["administrator", "support", "operator", "specialist", "sysadmin"],
    "noc": ["support", "operations", "network", "technician", "monitoring"],
    "analyst": ["associate", "researcher", "specialist", "consultant"],
    "associate": ["analyst", "junior", "assistant"],
    "architect": ["principal", "lead", "senior", "designer", "strategist"],
    "principal": ["architect", "lead", "staff", "distinguished"]
};

// ------------------------------------------------------------------
// Smart Helper Functions
// ------------------------------------------------------------------

/**
 * Checks if two skills are equivalent or highly transferable.
 * Returns true if there is a direct match, a synonym match, or shared category.
 */
export function isSkillEquivalent(skillA: string, skillB: string): boolean {
  if (!skillA || !skillB) return false;
  
  const a = skillA.toLowerCase().trim();
  const b = skillB.toLowerCase().trim();

  // 1. Direct Match
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  // 2. Lookup in Transferable Skills Map
  // Check if B is listed as a transferable skill for A
  if (TRANSFERABLE_SKILLS[a] && TRANSFERABLE_SKILLS[a].includes(b)) return true;
  // Check if A is listed as a transferable skill for B
  if (TRANSFERABLE_SKILLS[b] && TRANSFERABLE_SKILLS[b].includes(a)) return true;

  // 3. Common Parent/Category Check (heuristic)
  // If both share a common related skill in the map
  // e.g. "React" -> ["Javascript"], "Vue" -> ["Javascript"] => They are related
  const relatedA = TRANSFERABLE_SKILLS[a] || [];
  const relatedB = TRANSFERABLE_SKILLS[b] || [];
  
  const common = relatedA.filter(item => relatedB.includes(item));
  if (common.length > 0) return true;

  return false;
}

/**
 * Checks if two role titles are equivalent using fuzzy token matching.
 */
export function isRoleEquivalent(roleA: string, roleB: string): boolean {
    if (!roleA || !roleB) return false;

    const tokensA = roleA.toLowerCase().split(/[\s\-_]+/);
    const tokensB = roleB.toLowerCase().split(/[\s\-_]+/);

    // Check for overlap in significant tokens
    for (const tA of tokensA) {
        if (tA.length < 3) continue; // Skip short words

        // Direct token match
        if (tokensB.includes(tA)) return true;

        // Equivalence match
        if (ROLE_EQUIVALENCE[tA]) {
            const synonyms = ROLE_EQUIVALENCE[tA];
            // If any token in B matches a synonym of tA
            if (tokensB.some(tB => synonyms.includes(tB))) {
                return true;
            }
        }
    }
    
    return false;
}
