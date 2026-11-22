// Sample notes every new account can load, so the app can be tried in under a minute.
// Written for Viva Room; topics are pre-labelled so loading the sample needs no AI call.
import { db } from "./db";

const OS: { topic: string; page: number; text: string }[] = [
  {
    topic: "Scheduling criteria",
    page: 1,
    text: "CPU scheduling decides which process in the ready queue gets the CPU next. A good scheduler is judged on five criteria: CPU utilisation (keep the CPU busy), throughput (processes finished per unit time), turnaround time (time from submission to completion), waiting time (total time spent waiting in the ready queue) and response time (time from submission until the first response is produced). Interactive systems care most about response time, while batch systems care about throughput and turnaround time.",
  },
  {
    topic: "Preemptive vs non-preemptive",
    page: 1,
    text: "In non-preemptive scheduling, once a process gets the CPU it keeps it until it finishes or blocks for I/O. In preemptive scheduling, the operating system can take the CPU away, for example when a timer interrupt fires or when a higher priority process arrives. Preemption improves response time but adds context switch overhead and needs care around shared data, because a process can be interrupted in the middle of updating it.",
  },
  {
    topic: "FCFS scheduling",
    page: 2,
    text: "First Come First Served (FCFS) runs processes in the order they arrive, using a FIFO queue. It is simple and non-preemptive. Its main problem is the convoy effect: if one long CPU-bound process arrives first, many short processes wait behind it, so the average waiting time becomes high. Example: bursts of 24, 3 and 3 ms in that order give waiting times of 0, 24 and 27 ms, an average of 17 ms. If the short jobs had gone first, the average would drop to 3 ms.",
  },
  {
    topic: "SJF and SRTF",
    page: 2,
    text: "Shortest Job First (SJF) picks the process with the smallest next CPU burst. It gives the minimum average waiting time for a given set of processes, which makes it optimal on that measure. The catch is that the length of the next burst is not known in advance, so it is predicted with exponential averaging: tau(n+1) = alpha * t(n) + (1 - alpha) * tau(n), where t(n) is the latest actual burst and alpha is usually 0.5. The preemptive version is Shortest Remaining Time First (SRTF): a new arrival with a shorter burst than the remaining time of the running process takes over the CPU. SJF can starve long processes.",
  },
  {
    topic: "Round robin",
    page: 3,
    text: "Round Robin (RR) gives each process a fixed time quantum, typically 10 to 100 ms, and then moves it to the back of the ready queue. It is preemptive and designed for time sharing. If the quantum is very large, RR behaves like FCFS. If the quantum is very small, the CPU spends too much time on context switches. A rule of thumb is that about 80 percent of CPU bursts should be shorter than the quantum. RR usually has higher average turnaround than SJF but much better response time.",
  },
  {
    topic: "Priority scheduling",
    page: 3,
    text: "Priority scheduling gives the CPU to the process with the highest priority. It can be preemptive or non-preemptive. Its main problem is starvation (indefinite blocking): a low priority process may never run if higher priority work keeps arriving. The standard fix is aging, which gradually raises the priority of a process the longer it waits, so eventually it gets the CPU.",
  },
  {
    topic: "Multilevel queues",
    page: 4,
    text: "A multilevel queue scheduler splits the ready queue into separate queues, for example foreground (interactive) and background (batch), each with its own algorithm, such as RR for foreground and FCFS for background. Processes are permanently assigned to one queue. A multilevel feedback queue lets processes move between queues: a process that uses too much CPU time is moved to a lower priority queue, and a process that waits too long is moved up, which also prevents starvation.",
  },
  {
    topic: "Deadlock conditions",
    page: 5,
    text: "A deadlock is a set of processes where each one is waiting for a resource held by another process in the set, so none can proceed. Four conditions must hold at the same time for a deadlock to occur (the Coffman conditions): mutual exclusion (a resource can be held by only one process), hold and wait (a process holds at least one resource while waiting for more), no preemption (a resource can only be released voluntarily) and circular wait (a closed chain of processes, each waiting for the next).",
  },
  {
    topic: "Deadlock prevention",
    page: 5,
    text: "Deadlock prevention makes sure at least one of the four conditions can never hold. Hold and wait can be broken by making a process request all its resources at once, at the cost of low utilisation. No preemption can be broken by taking resources away from a waiting process. Circular wait is the most practical to break: give every resource type a number and require processes to request resources only in increasing order. Mutual exclusion usually cannot be removed for things like printers.",
  },
  {
    topic: "Banker's algorithm",
    page: 6,
    text: "Deadlock avoidance uses extra information about future requests. The Banker's algorithm keeps Available, Max, Allocation and Need matrices, where Need = Max - Allocation. A request is granted only if the system stays in a safe state, meaning there is at least one order (a safe sequence) in which every process can get its remaining need and finish. An unsafe state does not always lead to deadlock, but the system can no longer guarantee it will not. The safety check costs about m x n squared operations for m resource types and n processes.",
  },
  {
    topic: "Deadlock detection and recovery",
    page: 6,
    text: "If a system allows deadlocks to happen, it must detect them and recover. With a single instance of each resource, detection means finding a cycle in the wait-for graph. With multiple instances, an algorithm similar to the Banker's safety check is used. Recovery options are terminating processes (all deadlocked ones, or one at a time until the cycle breaks) or preempting resources, which needs choosing a victim, rolling it back, and making sure the same process is not always picked, which would cause starvation.",
  },
];

/** Copy the sample subject, with one finished practice viva, into a user's account. */
export async function loadSample(userId: string) {
  const subject = await db.subject.create({
    data: {
      userId,
      title: "Operating Systems, Unit 3: CPU Scheduling and Deadlocks",
      examDate: new Date(Date.now() + 4 * 86400000),
    },
  });
  const src = await db.source.create({
    data: {
      subjectId: subject.id,
      title: "OS Unit 3 class notes.pdf",
      kind: "pdf",
      pages: 6,
      chars: OS.reduce((a, c) => a + c.text.length, 0),
    },
  });
  await db.chunk.createMany({
    data: OS.map((c, i) => ({ sourceId: src.id, subjectId: subject.id, idx: i, page: c.page, topic: c.topic, text: c.text })),
  });
  const chunks = await db.chunk.findMany({ where: { sourceId: src.id }, orderBy: { idx: "asc" } });
  const byTopic = (t: string) => chunks.find((c) => c.topic === t)!;

  // One earlier session so the progress views are not empty.
  const day = 86400000;
  const started = new Date(Date.now() - 2 * day);
  const past = [
    {
      c: byTopic("FCFS scheduling"),
      q: "Why does FCFS give a high average waiting time when a long job arrives first?",
      a: "because the short jobs have to wait behind the long one, its called convoy effect",
      score: 8,
      verdict: "Good, you named the convoy effect. Back it with numbers next time.",
      got: ["Named the convoy effect", "Short jobs wait behind the long one"],
      missed: ["No example numbers, like 24, 3, 3 giving an average of 17 ms"],
      ev: "Its main problem is the convoy effect: if one long CPU-bound process arrives first, many short processes wait behind it, so the average waiting time becomes high.",
    },
    {
      c: byTopic("Round robin"),
      q: "What happens to round robin if you make the time quantum very small?",
      a: "it becomes faster because processes switch quickly",
      score: 3,
      verdict: "Not quite. Smaller is not faster here. Think about what the CPU does at every switch.",
      got: ["Processes switch more often"],
      missed: ["Context switch overhead dominates", "Too large a quantum turns RR into FCFS", "Rule of thumb: 80 percent of bursts shorter than the quantum"],
      ev: "If the quantum is very small, the CPU spends too much time on context switches.",
    },
    {
      c: byTopic("Deadlock conditions"),
      q: "Name the four conditions that must hold together for a deadlock.",
      a: "mutual exclusion, hold and wait, no preemption and circular wait",
      score: 9.5,
      verdict: "All four, in the right words. Well done.",
      got: ["All four Coffman conditions"],
      missed: ["Could add that all four must hold at the same time"],
      ev: "mutual exclusion (a resource can be held by only one process), hold and wait (a process holds at least one resource while waiting for more), no preemption (a resource can only be released voluntarily) and circular wait",
    },
  ];
  const session = await db.session.create({
    data: {
      userId,
      subjectId: subject.id,
      mode: "theory",
      strictness: "fair",
      length: 3,
      status: "done",
      startedAt: started,
      endedAt: new Date(started.getTime() + 9 * 60000),
      score: Number((past.reduce((a, p) => a + p.score, 0) / past.length).toFixed(2)),
      summary: JSON.stringify({
        headline: "Solid on deadlocks, shaky on how the round robin quantum affects performance.",
        strengths: ["Recalled all four deadlock conditions precisely", "Knew the convoy effect by name"],
        fixes: ["Revise why a tiny quantum hurts: context switch overhead", "Practise one FCFS waiting time example with numbers"],
        nextStep: "Do a 5 question rapid fire on scheduling tonight.",
      }),
    },
  });
  for (const [i, p] of past.entries()) {
    await db.turn.create({
      data: {
        sessionId: session.id,
        chunkId: p.c.id,
        idx: i,
        status: "graded",
        question: p.q,
        answer: p.a,
        seconds: 20 + i * 7,
        spoken: true,
        score: p.score,
        verdict: p.verdict,
        got: JSON.stringify(p.got),
        missed: JSON.stringify(p.missed),
        evidence: p.ev,
        evidenceVerified: true,
        createdAt: new Date(started.getTime() + i * 150000),
      },
    });
    const interval = p.score >= 7.5 ? 2 : 0.007;
    await db.chunk.update({
      where: { id: p.c.id },
      data: { reviews: 1, lastScore: p.score, intervalDays: interval, dueAt: new Date(started.getTime() + interval * day) },
    });
  }
  return subject;
}
