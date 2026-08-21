import { and, asc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, queueEntriesTable, queuesTable } from "@workspace/db";
import {
  CallNextQueueEntryParams,
  CallNextQueueEntryResponse,
  CreateQueueBody,
  CreateQueueResponse,
  GetQueueEntryParams,
  GetQueueEntryResponse,
  GetQueueParams,
  GetQueueResponse,
  GetQueueSummaryParams,
  GetQueueSummaryResponse,
  JoinQueueBody,
  JoinQueueParams,
  JoinQueueResponse,
  LeaveQueueParams,
  ListQueueEntriesParams,
  ListQueueEntriesResponse,
  ListQueuesResponse,
  ServeQueueEntryParams,
  ServeQueueEntryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type QueueRow = typeof queuesTable.$inferSelect;
type EntryRow = typeof queueEntriesTable.$inferSelect;

const activeStatuses = ["waiting", "called"] as const;

async function getQueue(queueId: number): Promise<QueueRow | undefined> {
  const [queue] = await db
    .select()
    .from(queuesTable)
    .where(eq(queuesTable.id, queueId));
  return queue;
}

async function getActiveEntries(queueId: number): Promise<EntryRow[]> {
  return db
    .select()
    .from(queueEntriesTable)
    .where(
      and(
        eq(queueEntriesTable.queueId, queueId),
        sql`${queueEntriesTable.status} in ('waiting', 'called')`,
      ),
    )
    .orderBy(asc(queueEntriesTable.joinedAt), asc(queueEntriesTable.id));
}

function formatQueue(queue: QueueRow, entries: EntryRow[]) {
  const waitingCount = entries.length;
  return {
    id: queue.id,
    establishmentName: queue.establishmentName,
    status: queue.status,
    averageMinutes: queue.averageMinutes,
    waitingCount,
    estimatedMinutes: waitingCount * queue.averageMinutes,
    createdAt: queue.createdAt,
  };
}

function formatEntry(
  entry: EntryRow,
  queue: QueueRow,
  entries: EntryRow[],
) {
  const activeIndex = entries.findIndex((item) => item.id === entry.id);
  const isActive = activeIndex >= 0;
  const position = isActive ? activeIndex + 1 : 0;
  return {
    id: entry.id,
    queueId: entry.queueId,
    name: entry.name,
    position,
    peopleAhead: isActive ? activeIndex : 0,
    estimatedMinutes: isActive ? activeIndex * queue.averageMinutes : 0,
    joinedAt: entry.joinedAt,
    status: entry.status,
  };
}

async function findEntry(queueId: number, entryId: number) {
  const [entry] = await db
    .select()
    .from(queueEntriesTable)
    .where(
      and(
        eq(queueEntriesTable.queueId, queueId),
        eq(queueEntriesTable.id, entryId),
      ),
    );
  return entry;
}

router.get("/queues", async (_req, res): Promise<void> => {
  const queues = await db
    .select()
    .from(queuesTable)
    .where(eq(queuesTable.status, "open"))
    .orderBy(asc(queuesTable.createdAt));
  const result = await Promise.all(
    queues.map(async (queue) =>
      formatQueue(queue, await getActiveEntries(queue.id)),
    ),
  );
  res.json(ListQueuesResponse.parse(result));
});

router.post("/queues", async (req, res): Promise<void> => {
  const parsed = CreateQueueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [queue] = await db
    .insert(queuesTable)
    .values({
      establishmentName: parsed.data.establishmentName.trim(),
      averageMinutes: parsed.data.averageMinutes ?? 5,
    })
    .returning();
  const result = formatQueue(queue, []);
  res.status(201).json(CreateQueueResponse.parse(result));
});

router.get("/queues/:queueId", async (req, res): Promise<void> => {
  const params = GetQueueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queue = await getQueue(params.data.queueId);
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  res.json(GetQueueResponse.parse(formatQueue(queue, await getActiveEntries(queue.id))));
});

router.get("/queues/:queueId/entries", async (req, res): Promise<void> => {
  const params = ListQueueEntriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queue = await getQueue(params.data.queueId);
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  const entries = await getActiveEntries(queue.id);
  res.json(ListQueueEntriesResponse.parse(entries.map((entry) => formatEntry(entry, queue, entries))));
});

router.post("/queues/:queueId/entries", async (req, res): Promise<void> => {
  const params = JoinQueueParams.safeParse(req.params);
  const body = JoinQueueBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const queue = await getQueue(params.data.queueId);
  if (!queue || queue.status !== "open") {
    res.status(404).json({ error: "Queue not found or closed" });
    return;
  }
  const [entry] = await db
    .insert(queueEntriesTable)
    .values({ queueId: queue.id, name: body.data.name.trim() })
    .returning();
  const entries = await getActiveEntries(queue.id);
  res.status(201).json(JoinQueueResponse.parse(formatEntry(entry, queue, entries)));
});

router.get("/queues/:queueId/entries/:entryId", async (req, res): Promise<void> => {
  const params = GetQueueEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queue = await getQueue(params.data.queueId);
  const entry = await findEntry(params.data.queueId, params.data.entryId);
  if (!queue || !entry) {
    res.status(404).json({ error: "Queue entry not found" });
    return;
  }
  const entries = await getActiveEntries(queue.id);
  res.json(GetQueueEntryResponse.parse(formatEntry(entry, queue, entries)));
});

router.delete("/queues/:queueId/entries/:entryId", async (req, res): Promise<void> => {
  const params = LeaveQueueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [entry] = await db
    .update(queueEntriesTable)
    .set({ status: "left" })
    .where(
      and(
        eq(queueEntriesTable.queueId, params.data.queueId),
        eq(queueEntriesTable.id, params.data.entryId),
        sql`${queueEntriesTable.status} in ('waiting', 'called')`,
      ),
    )
    .returning();
  if (!entry) {
    res.status(404).json({ error: "Queue entry not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/queues/:queueId/entries/:entryId/serve", async (req, res): Promise<void> => {
  const params = ServeQueueEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [entry] = await db
    .update(queueEntriesTable)
    .set({ status: "served", servedAt: new Date() })
    .where(
      and(
        eq(queueEntriesTable.queueId, params.data.queueId),
        eq(queueEntriesTable.id, params.data.entryId),
        eq(queueEntriesTable.status, "called"),
      ),
    )
    .returning();
  const queue = await getQueue(params.data.queueId);
  if (!entry || !queue) {
    res.status(404).json({ error: "Called queue entry not found" });
    return;
  }
  res.json(ServeQueueEntryResponse.parse(formatEntry(entry, queue, await getActiveEntries(queue.id))));
});

router.post("/queues/:queueId/next", async (req, res): Promise<void> => {
  const params = CallNextQueueEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queue = await getQueue(params.data.queueId);
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  const [entry] = await db
    .select()
    .from(queueEntriesTable)
    .where(
      and(
        eq(queueEntriesTable.queueId, queue.id),
        eq(queueEntriesTable.status, "waiting"),
      ),
    )
    .orderBy(asc(queueEntriesTable.joinedAt), asc(queueEntriesTable.id))
    .limit(1);
  if (!entry) {
    res.status(409).json({ error: "No customers are waiting" });
    return;
  }
  const [called] = await db
    .update(queueEntriesTable)
    .set({ status: "called", calledAt: new Date() })
    .where(eq(queueEntriesTable.id, entry.id))
    .returning();
  const entries = await getActiveEntries(queue.id);
  res.json(CallNextQueueEntryResponse.parse(formatEntry(called, queue, entries)));
});

router.get("/queues/:queueId/summary", async (req, res): Promise<void> => {
  const params = GetQueueSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queue = await getQueue(params.data.queueId);
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  const allEntries = await db
    .select()
    .from(queueEntriesTable)
    .where(eq(queueEntriesTable.queueId, queue.id))
    .orderBy(sql`${queueEntriesTable.joinedAt} desc`);
  const activeEntries = allEntries.filter((entry) =>
    activeStatuses.includes(entry.status as (typeof activeStatuses)[number]),
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const servedToday = allEntries.filter(
    (entry) => entry.status === "served" && entry.servedAt && entry.servedAt >= today,
  ).length;
  const called = activeEntries.filter((entry) => entry.status === "called").length;
  const recentActivity = allEntries.slice(0, 8).map((entry) => ({
    id: entry.id,
    name: entry.name,
    status: entry.status,
    timestamp: entry.servedAt ?? entry.calledAt ?? entry.joinedAt,
  }));
  const result = {
    queue: formatQueue(queue, activeEntries),
    waiting: activeEntries.length,
    called,
    servedToday,
    averageWaitMinutes: queue.averageMinutes,
    recentActivity,
  };
  res.json(GetQueueSummaryResponse.parse(result));
});

export default router;