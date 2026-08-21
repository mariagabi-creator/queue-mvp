import { relations } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const queueStatusEnum = pgEnum("queue_status", ["open", "closed"]);
export const queueEntryStatusEnum = pgEnum("queue_entry_status", [
  "waiting",
  "called",
  "served",
  "left",
]);

export const queuesTable = pgTable("queues", {
  id: serial("id").primaryKey(),
  establishmentName: text("establishment_name").notNull(),
  status: queueStatusEnum("status").notNull().default("open"),
  averageMinutes: integer("average_minutes").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const queueEntriesTable = pgTable("queue_entries", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id")
    .notNull()
    .references(() => queuesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: queueEntryStatusEnum("status").notNull().default("waiting"),
  joinedAt: timestamp("joined_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  calledAt: timestamp("called_at", { withTimezone: true }),
  servedAt: timestamp("served_at", { withTimezone: true }),
});

export const queuesRelations = relations(queuesTable, ({ many }) => ({
  entries: many(queueEntriesTable),
}));

export const queueEntriesRelations = relations(
  queueEntriesTable,
  ({ one }) => ({
    queue: one(queuesTable, {
      fields: [queueEntriesTable.queueId],
      references: [queuesTable.id],
    }),
  }),
);

export const insertQueueSchema = createInsertSchema(queuesTable).omit({
  id: true,
  createdAt: true,
});
export const insertQueueEntrySchema = createInsertSchema(
  queueEntriesTable,
).omit({
  id: true,
  joinedAt: true,
  calledAt: true,
  servedAt: true,
});

export type InsertQueue = z.infer<typeof insertQueueSchema>;
export type Queue = typeof queuesTable.$inferSelect;
export type InsertQueueEntry = z.infer<typeof insertQueueEntrySchema>;
export type QueueEntry = typeof queueEntriesTable.$inferSelect;