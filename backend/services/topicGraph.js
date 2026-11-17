/**
 * Directed-graph algorithms over one course's topics.
 *
 * A topic depends on its `prerequisites` (other topic slugs in the same
 * course) instead of only on "the topic before it in the list", so a
 * learner can, for example, need both Arrays and Searching before Binary
 * Search-style questions unlock, while two unrelated topics stay
 * independently open.
 *
 * This module is pure and dependency free - it never touches the database
 * or knows about a specific learner, so it can be unit tested on its own.
 */

/** Builds an adjacency list plus indegree map from a course's topic rows. */
function buildGraph(topics) {
  const bySlug = new Map(topics.map((t) => [t.slug, t]));
  const nodes = topics.map((t) => t.slug);
  const dependents = new Map(nodes.map((slug) => [slug, []])); // prereq -> [topics that need it]
  const prereqsOf = new Map();
  const indegree = new Map();

  for (const t of topics) {
    // Ignore a prerequisite that points at itself or at a slug that doesn't
    // exist in this course - bad seed data should never lock the app up.
    const prereqs = [...new Set((t.prerequisites || []).filter((p) => bySlug.has(p) && p !== t.slug))];
    prereqsOf.set(t.slug, prereqs);
    indegree.set(t.slug, prereqs.length);
    for (const p of prereqs) dependents.get(p).push(t.slug);
  }

  return { nodes, dependents, prereqsOf, indegree, bySlug };
}

/**
 * Kahn's algorithm: a valid learning order where every topic comes after all
 * of its prerequisites, or `null` if the prerequisites contain a cycle.
 */
function topologicalOrder(graph) {
  const indegree = new Map(graph.indegree);
  const byOrder = (a, b) => (graph.bySlug.get(a).order || 0) - (graph.bySlug.get(b).order || 0);
  const queue = graph.nodes.filter((n) => indegree.get(n) === 0).sort(byOrder);
  const order = [];

  while (queue.length) {
    queue.sort(byOrder);
    const slug = queue.shift();
    order.push(slug);
    for (const next of graph.dependents.get(slug)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }

  return order.length === graph.nodes.length ? order : null;
}

/**
 * BFS/topological unlock pass: a topic unlocks once every one of its
 * prerequisites is in `completedSlugs`. Walking the topics in topological
 * order means a prerequisite is always resolved before anything that needs
 * it is checked, in a single O(V + E) sweep.
 *
 * Falls back to "every topic is a root" if the graph has a cycle - a bad
 * edit to the prerequisite list should never lock an entire course.
 */
function unlockedSlugs(graph, completedSlugs = []) {
  const completed = new Set(completedSlugs);
  const order = topologicalOrder(graph);

  // A cycle means the prerequisite data itself is broken - fail open rather
  // than locking the whole course behind an impossible requirement.
  if (!order) return new Set(graph.nodes);

  const unlocked = new Set();
  for (const slug of order) {
    const prereqs = graph.prereqsOf.get(slug) || [];
    if (prereqs.every((p) => completed.has(p))) unlocked.add(slug);
  }
  return unlocked;
}

module.exports = { buildGraph, topologicalOrder, unlockedSlugs };
