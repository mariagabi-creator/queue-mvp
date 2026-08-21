import { useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'wouter';
import {
  ArrowRight,
  Bell,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  HeartHandshake,
  LogOut,
  MoreHorizontal,
  PhoneCall,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  getGetQueueEntryQueryKey,
  getGetQueueQueryKey,
  getGetQueueSummaryQueryKey,
  getListQueueEntriesQueryKey,
  getListQueuesQueryKey,
  useCallNextQueueEntry,
  useCreateQueue,
  useGetQueue,
  useGetQueueEntry,
  useGetQueueSummary,
  useJoinQueue,
  useLeaveQueue,
  useListQueueEntries,
  useListQueues,
  useServeQueueEntry,
} from '@workspace/api-client-react';
import type { Queue, QueueActivity, QueueEntry } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';

const demoId = 1;

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-3 ${dark ? 'text-[#f8f1df]' : 'text-[#193a41]'}`} data-testid="link-brand">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${dark ? 'bg-[#e5bb5c] text-[#193a41]' : 'bg-[#193a41] text-[#f8f1df]'}`}>
        <span className="font-mono text-[15px] font-medium">Q/</span>
      </span>
      <span className="text-[17px] font-extrabold tracking-[-.04em]">queue</span>
    </Link>
  );
}

function PageShell({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <div className={`grain min-h-[100dvh] ${dark ? 'bg-[#193a41] text-[#f8f1df]' : 'bg-[#f8f1df] text-[#193a41]'}`}>{children}</div>;
}

function TopBar({ dark = false, staff = false }: { dark?: boolean; staff?: boolean }) {
  return (
    <header className={`mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-5 md:px-8 ${dark ? '' : 'border-b border-[#dcd5c5]'}`}>
      <Brand dark={dark} />
      <div className="flex items-center gap-3">
        <span className={`hidden text-xs font-semibold tracking-[.1em] sm:inline ${dark ? 'text-[#b4ccc8]' : 'text-[#6b7b77]'}`}>
          {staff ? 'STAFF CONSOLE' : 'A CALMER WAY TO WAIT'}
        </span>
        {staff ? <Link href="/" className="rounded-full border border-[#396169] px-4 py-2 text-xs font-bold text-[#d7e5df] hover:bg-[#2a5158]" data-testid="link-exit-staff">Exit staff view</Link> : null}
      </div>
    </header>
  );
}

function LoadingState({ label = 'Getting things ready' }: { label?: string }) {
  return <div className="flex min-h-[280px] items-center justify-center p-8"><div className="w-full max-w-sm space-y-4 text-center"><div className="mx-auto h-3 w-24 animate-pulse rounded-full bg-[#ddd5c5]" /><div className="mx-auto h-9 w-56 animate-pulse rounded-xl bg-[#e5dfd1]" /><p className="font-mono text-xs text-[#6b7b77]">{label}...</p></div></div>;
}

function ErrorState({ retry, title = 'That did not load' }: { retry?: () => void; title?: string }) {
  return <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#f4d9c8] text-[#a8483e]"><CircleAlert size={22} /></span><h2 className="text-xl font-extrabold">{title}</h2><p className="text-sm leading-6 text-[#6b7b77]">The queue may be taking a quick breath. Try again in a moment.</p>{retry ? <Button onClick={retry} className="rounded-full bg-[#193a41] px-5" data-testid="button-retry"><RefreshCw size={15} /> Try again</Button> : null}</div>;
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-[#d9eadc] text-[#2c674c]',
    waiting: 'bg-[#e5edf0] text-[#315f67]',
    called: 'bg-[#f5dfaa] text-[#77561b]',
    served: 'bg-[#d9eadc] text-[#2c674c]',
    left: 'bg-[#eadfdb] text-[#83584d]',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] ${styles[status] ?? styles.waiting}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}

function QueueStats({ queue }: { queue: Queue }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-[#dcd5c5] rounded-2xl border border-[#dcd5c5] bg-[#fbf7ed]">
      <div className="p-4 text-center"><p className="font-mono text-2xl font-medium">{queue.waitingCount}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#6b7b77]">in line</p></div>
      <div className="p-4 text-center"><p className="font-mono text-2xl font-medium">{queue.estimatedMinutes}<span className="text-sm">m</span></p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#6b7b77]">estimated</p></div>
      <div className="p-4 text-center"><p className="font-mono text-2xl font-medium">{queue.averageMinutes}<span className="text-sm">m</span></p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#6b7b77]">per guest</p></div>
    </div>
  );
}

export function HomePage() {
  const { data: queues, isLoading, isError, refetch } = useListQueues({ query: { queryKey: getListQueuesQueryKey() } });
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const createQueue = useCreateQueue();
  const firstQueue = queues?.[0];
  const openQueue = () => firstQueue ? `/queue/${firstQueue.id}` : '#';
  const handleCreate = () => {
    if (!name.trim()) return;
    createQueue.mutate({ data: { establishmentName: name.trim(), averageMinutes: 15 } }, { onSuccess: () => { setName(''); setShowCreate(false); queryClient.invalidateQueries({ queryKey: getListQueuesQueryKey() }); } });
  };
  return (
    <PageShell>
      <TopBar />
      <main className="mx-auto max-w-[1240px] px-5 pb-20 md:px-8">
        <section className="grid-paper relative mt-7 overflow-hidden rounded-[2rem] border border-[#dcd5c5] bg-[#e4eee8] px-7 py-14 md:mt-10 md:px-16 md:py-20">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full border-[40px] border-[#d1e2d7] opacity-80" />
          <div className="relative max-w-3xl queue-rise">
            <p className="mb-6 flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[.15em] text-[#48746e]"><span className="h-2 w-2 rounded-full bg-[#4f8c6c]" /> Your place, held</p>
            <h1 className="max-w-3xl text-5xl font-extrabold leading-[.99] tracking-[-.065em] md:text-7xl">Wait somewhere better.</h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#46615f]">Queue turns the line into a little more freedom. Know your place, get a clear call, and spend the wait how you want.</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              {isLoading ? <div className="h-12 w-48 animate-pulse rounded-full bg-[#c9ded1]" /> : <Link href={openQueue()} className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-[#193a41] px-6 text-sm font-bold text-[#f8f1df] hover:-translate-y-0.5 hover:bg-[#28535a]" data-testid="link-open-demo"><span>See the guest view</span><ArrowRight size={16} /></Link>}
              <Link href="/staff" className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-[#abc5bd] px-6 text-sm font-bold text-[#193a41] hover:-translate-y-0.5 hover:bg-[#d7e7df]" data-testid="link-staff-dashboard">Open staff dashboard <ExternalLink size={15} /></Link>
            </div>
          </div>
          <div className="relative mt-14 flex items-end justify-end md:absolute md:bottom-12 md:right-16 md:mt-0">
            <div className="w-full max-w-[260px] rotate-2 rounded-[1.5rem] border border-[#c8d8ce] bg-[#faf7ee] p-5 shadow-[0_20px_45px_rgba(25,58,65,.14)]">
              <div className="mb-8 flex items-center justify-between"><span className="font-mono text-[10px] text-[#6b7b77]">LIVE NOW</span><span className="h-2 w-2 rounded-full bg-[#4f8c6c]" /></div>
              <p className="text-xs font-bold text-[#6b7b77]">At</p><p className="mt-1 text-xl font-extrabold">Northstar Café</p>
              <div className="mt-7 border-t border-[#ded7c8] pt-5"><p className="font-mono text-4xl">09</p><p className="mt-1 text-xs text-[#6b7b77]">people ahead of you</p></div>
              <div className="mt-6 h-2 rounded-full bg-[#e2eadf]"><div className="h-full w-[62%] rounded-full bg-[#e5bb5c]" /></div>
            </div>
          </div>
        </section>
        <section className="grid gap-5 py-16 md:grid-cols-[1fr_1.35fr] md:py-24">
          <div className="queue-rise queue-delay-1"><p className="font-mono text-xs uppercase tracking-[.13em] text-[#6b7b77]">Built for busy places</p><h2 className="mt-4 max-w-md text-3xl font-extrabold leading-tight tracking-[-.045em]">A quiet update is better than a crowded room.</h2></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[{icon: Clock3, title: 'Clear timing', text: 'An honest estimate, not a vague “soon”.'}, {icon: HeartHandshake, title: 'More dignity', text: 'Guests can step away without losing their place.'}, {icon: ShieldCheck, title: 'Less pressure', text: 'Staff move the line with a focused view.'}].map(({ icon: Icon, title, text }, i) => <div key={title} className={`queue-rise queue-delay-${i + 1} rounded-2xl border border-[#dcd5c5] bg-[#fbf7ed] p-5`}><Icon size={19} className="text-[#4c7f73]" /><h3 className="mt-8 text-sm font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#6b7b77]">{text}</p></div>)}
          </div>
        </section>
        <section className="flex flex-col justify-between gap-6 border-t border-[#dcd5c5] py-10 md:flex-row md:items-center">
          <div><p className="text-sm font-bold">Are you opening a queue?</p><p className="mt-1 text-sm text-[#6b7b77]">Set up a simple public line for your guests.</p></div>
          <Button variant="outline" className="w-fit rounded-full border-[#b8c7bd] bg-transparent" onClick={() => setShowCreate((v) => !v)} data-testid="button-create-queue"><Plus size={15} /> {showCreate ? 'Close setup' : 'Create a demo queue'}</Button>
        </section>
        {showCreate ? <div className="mb-10 flex max-w-xl flex-col gap-3 rounded-2xl border border-[#dcd5c5] bg-[#fbf7ed] p-5 sm:flex-row"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="Establishment name" className="h-11 min-w-0 flex-1 rounded-xl border border-[#cfc6b4] bg-[#f8f1df] px-4 text-sm outline-none ring-[#4c7f73] focus:ring-2" data-testid="input-establishment-name" /><Button onClick={handleCreate} disabled={createQueue.isPending || !name.trim()} className="h-11 rounded-xl bg-[#193a41]" data-testid="button-submit-queue">{createQueue.isPending ? 'Opening...' : 'Open queue'}</Button></div> : null}
        {isError ? <ErrorState retry={refetch} /> : null}
      </main>
    </PageShell>
  );
}

function PublicQueuePage() {
  const { queueId } = useParams<{ queueId: string }>();
  const id = Number(queueId);
  const [, setLocation] = useLocation();
  const { data: queue, isLoading, isError, refetch } = useGetQueue(id, { query: { queryKey: getGetQueueQueryKey(id), refetchInterval: 10000 } });
  if (isLoading) return <PageShell><TopBar /><LoadingState label="Checking the line" /></PageShell>;
  if (isError || !queue) return <PageShell><TopBar /><ErrorState retry={refetch} title="We could not find that queue" /></PageShell>;
  return <PageShell><TopBar /><main className="mx-auto max-w-[1060px] px-5 pb-20 pt-10 md:px-8 md:pt-16"><Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#6b7b77] hover:text-[#193a41]" data-testid="link-back-home">← Back to Queue</Link><div className="mt-12 grid gap-10 md:grid-cols-[1.1fr_.9fr] md:items-start"><div className="queue-rise"><div className="flex items-center gap-3"><StatusPill status={queue.status} /><span className="font-mono text-xs text-[#6b7b77]">UPDATED JUST NOW</span></div><h1 className="mt-7 max-w-xl text-5xl font-extrabold leading-[1.02] tracking-[-.065em] md:text-6xl" data-testid="text-establishment-name">{queue.establishmentName}</h1><p className="mt-5 max-w-lg text-base leading-7 text-[#6b7b77]">Join the line from wherever you are. We will keep your place warm while you take a breath.</p><div className="mt-9"><QueueStats queue={queue} /></div></div><div className="queue-rise queue-delay-1 rounded-[1.5rem] border border-[#dcd5c5] bg-[#fbf7ed] p-6 shadow-[0_18px_40px_rgba(25,58,65,.07)]"><p className="font-mono text-xs uppercase tracking-[.14em] text-[#6b7b77]">Your next move</p><h2 className="mt-4 text-2xl font-extrabold tracking-[-.04em]">{queue.status === 'open' ? 'Take a place in line' : 'This queue is closed'}</h2><p className="mt-3 text-sm leading-6 text-[#6b7b77]">{queue.status === 'open' ? 'It takes a few seconds. You will get a live link to follow your place.' : 'Please check back later or contact the establishment directly.'}</p><Button disabled={queue.status !== 'open'} onClick={() => setLocation(`/queue/${id}/join`)} className="mt-7 h-12 w-full rounded-xl bg-[#e5bb5c] text-[#193a41] hover:bg-[#efc96f]" data-testid="button-join-queue">{queue.status === 'open' ? 'Join the queue' : 'Queue closed'} <ArrowRight size={16} /></Button><p className="mt-4 text-center text-[11px] text-[#8b938c]">No account or app download needed</p></div></div><div className="mt-20 grid gap-4 border-t border-[#dcd5c5] pt-8 sm:grid-cols-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#6b7b77]">What happens next</p></div><p className="text-sm leading-6 text-[#6b7b77]"><strong className="text-[#193a41]">01 — Get your place.</strong><br />A private link keeps you in the loop.</p><p className="text-sm leading-6 text-[#6b7b77]"><strong className="text-[#193a41]">02 — Carry on.</strong><br />Step away. We will update the estimate.</p></div></main></PageShell>;
}

function JoinPage() {
  const { queueId } = useParams<{ queueId: string }>();
  const id = Number(queueId);
  const [, setLocation] = useLocation();
  const { data: queue, isLoading } = useGetQueue(id, { query: { queryKey: getGetQueueQueryKey(id) } });
  const join = useJoinQueue();
  const [name, setName] = useState('');
  if (isLoading) return <PageShell><TopBar /><LoadingState label="Opening guest view" /></PageShell>;
  if (!queue) return <PageShell><TopBar /><ErrorState title="This queue is not available" /></PageShell>;
  const submit = () => { if (!name.trim()) return; join.mutate({ queueId: id, data: { name: name.trim() } }, { onSuccess: (entry) => setLocation(`/queue/${id}/ticket/${entry.id}`) }); };
  return <PageShell><TopBar /><main className="mx-auto max-w-[680px] px-5 pb-20 pt-12 md:px-8 md:pt-20"><Link href={`/queue/${id}`} className="text-xs font-bold text-[#6b7b77]" data-testid="link-back-queue">← {queue.establishmentName}</Link><div className="mt-14"><p className="font-mono text-xs uppercase tracking-[.14em] text-[#6b7b77]">Step 01 / 01</p><h1 className="mt-5 text-4xl font-extrabold tracking-[-.06em] md:text-5xl">What name should we call?</h1><p className="mt-4 max-w-md text-base leading-7 text-[#6b7b77]">Use a name your party will recognize when it is your turn.</p><div className="mt-10 rounded-[1.5rem] border border-[#dcd5c5] bg-[#fbf7ed] p-5 md:p-7"><label htmlFor="guest-name" className="text-xs font-extrabold uppercase tracking-[.12em]">Guest name</label><input id="guest-name" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="e.g. Maya" className="mt-3 h-14 w-full rounded-xl border border-[#cfc6b4] bg-[#f8f1df] px-4 text-lg outline-none focus:border-[#4c7f73] focus:ring-2 focus:ring-[#4c7f73]/20" data-testid="input-guest-name" /><div className="mt-5 flex items-start gap-3 rounded-xl bg-[#e8efe8] p-4 text-xs leading-5 text-[#527169]"><ShieldCheck size={17} className="mt-0.5 shrink-0" />Your link is private to you. Save it if you want to check back later.</div><Button onClick={submit} disabled={!name.trim() || join.isPending} className="mt-6 h-12 w-full rounded-xl bg-[#193a41]" data-testid="button-confirm-join">{join.isPending ? 'Finding your place...' : 'Get my place'} <ArrowRight size={16} /></Button>{join.isError ? <p className="mt-3 text-center text-xs text-[#a8483e]">We could not add you just now. Please try again.</p> : null}</div></div></main></PageShell>;
}

function TicketPage() {
  const { queueId, entryId } = useParams<{ queueId: string; entryId: string }>();
  const qid = Number(queueId); const eid = Number(entryId);
  const queryClient = useQueryClient(); const [, setLocation] = useLocation();
  const { data: queue } = useGetQueue(qid, { query: { queryKey: getGetQueueQueryKey(qid), refetchInterval: 10000 } });
  const { data: entry, isLoading, isError, refetch } = useGetQueueEntry(qid, eid, { query: { queryKey: getGetQueueEntryQueryKey(qid, eid), refetchInterval: 5000 } });
  const leave = useLeaveQueue();
  const leaveLine = () => { if (window.confirm('Leave your place in this queue?')) leave.mutate({ queueId: qid, entryId: eid }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetQueueEntryQueryKey(qid, eid) }); queryClient.invalidateQueries({ queryKey: getListQueueEntriesQueryKey(qid) }); setLocation(`/queue/${qid}`); } }); };
  if (isLoading) return <PageShell><TopBar /><LoadingState label="Finding your place" /></PageShell>;
  if (isError || !entry || !queue) return <PageShell><TopBar /><ErrorState retry={refetch} title="We lost the thread" /></PageShell>;
  const called = entry.status === 'called'; const done = entry.status === 'served' || entry.status === 'left';
  return <PageShell><TopBar /><main className="mx-auto max-w-[850px] px-5 pb-20 pt-10 md:px-8 md:pt-16"><div className="flex items-center justify-between"><Link href={`/queue/${qid}`} className="text-xs font-bold text-[#6b7b77]" data-testid="link-ticket-queue">← {queue.establishmentName}</Link><span className="font-mono text-[10px] uppercase tracking-[.13em] text-[#6b7b77]">LIVE TICKET</span></div><section className={`mt-12 overflow-hidden rounded-[2rem] border p-7 md:p-12 ${called ? 'border-[#d8b85b] bg-[#f5dfaa]' : 'border-[#c9dcd2] bg-[#e4eee8]'}`}><div className="flex items-start justify-between gap-5"><div><p className="font-mono text-xs uppercase tracking-[.14em] text-[#527169]">{called ? 'It is your turn' : done ? 'This ticket is closed' : 'You are in line'}</p><h1 className="mt-4 text-4xl font-extrabold tracking-[-.06em] md:text-5xl" data-testid="text-ticket-name">Hi, {entry.name}.</h1></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#193a41] text-[#f8f1df]">{called ? <Bell size={22} /> : done ? <Check size={22} /> : <Clock3 size={22} />}</span></div>{called ? <div className="mt-12 rounded-2xl bg-[#fff4cc]/70 p-5"><p className="text-lg font-extrabold">Please head to the host now.</p><p className="mt-2 text-sm text-[#77561b]">We are ready for you at {queue.establishmentName}.</p></div> : done ? <div className="mt-12 rounded-2xl bg-[#f8f1df]/60 p-5 text-sm text-[#527169]">Thanks for letting us know. This ticket is no longer active.</div> : <div className="mt-12 grid gap-5 sm:grid-cols-[1fr_1fr]"><div><p className="font-mono text-7xl leading-none tracking-[-.1em]" data-testid="text-queue-position">{entry.position}</p><p className="mt-2 text-xs font-bold uppercase tracking-[.12em] text-[#527169]">your position</p></div><div className="sm:border-l sm:border-[#b8d0c4] sm:pl-7"><p className="font-mono text-3xl">{entry.peopleAhead}</p><p className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-[#527169]">people ahead</p><p className="mt-7 text-sm text-[#527169]">Estimated wait <strong className="text-[#193a41]">about {entry.estimatedMinutes} min</strong></p></div></div>} {!done && !called ? <div className="mt-10"><div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-[.12em] text-[#527169]"><span>Moving steadily</span><span>{entry.peopleAhead === 0 ? 'Almost there' : 'Live updates'}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#c5dbce]"><div className="h-full rounded-full bg-[#4f8c6c] transition-all" style={{ width: `${Math.max(12, Math.min(92, 100 - entry.peopleAhead * 8))}%` }} /></div></div> : null}</section><div className="mt-8 flex flex-col justify-between gap-5 border-b border-[#dcd5c5] pb-8 sm:flex-row sm:items-center"><div><p className="text-sm font-bold">Keep this link handy</p><p className="mt-1 text-xs text-[#6b7b77]">Your place refreshes automatically while you wait.</p></div>{!done && !called ? <Button variant="outline" onClick={leaveLine} disabled={leave.isPending} className="rounded-full border-[#cfc6b4] bg-transparent text-[#83584d]" data-testid="button-leave-queue"><LogOut size={15} /> {leave.isPending ? 'Leaving...' : 'Leave queue'}</Button> : null}</div><p className="mt-7 text-center font-mono text-[10px] uppercase tracking-[.14em] text-[#89938b]">Ticket #{String(entry.id).padStart(4, '0')} · {queue.establishmentName}</p></main></PageShell>;
}

function ActivityRow({ activity }: { activity: QueueActivity }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[#e1dbce] py-3 last:border-0"><div className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#dbe8e0] text-xs font-extrabold text-[#39675d]">{activity.name.slice(0, 1).toUpperCase()}</span><span className="truncate text-sm font-bold">{activity.name}</span></div><div className="flex shrink-0 items-center gap-3"><StatusPill status={activity.status} /><span className="font-mono text-[10px] text-[#8b938c]">{new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div>;
}

function StaffPage() {
  const queryClient = useQueryClient();
  const { data: queues, isLoading: queuesLoading, isError: queuesError, refetch: retryQueues } = useListQueues({ query: { queryKey: getListQueuesQueryKey(), refetchInterval: 15000 } });
  const queue = queues?.[0];
  const id = queue?.id ?? demoId;
  const { data: entries, isLoading: entriesLoading, isError: entriesError, refetch: retryEntries } = useListQueueEntries(id, { query: { queryKey: getListQueueEntriesQueryKey(id), refetchInterval: 5000 } });
  const { data: summary } = useGetQueueSummary(id, { query: { queryKey: getGetQueueSummaryQueryKey(id), refetchInterval: 15000 } });
  const callNext = useCallNextQueueEntry();
  const serve = useServeQueueEntry();
  const leave = useLeaveQueue();
  const [feedback, setFeedback] = useState('');
  const activeEntries = useMemo(() => (entries ?? []).filter((entry) => entry.status === 'waiting' || entry.status === 'called'), [entries]);
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListQueueEntriesQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getGetQueueSummaryQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey(id) }); };
  const next = () => { callNext.mutate({ queueId: id }, { onSuccess: () => { setFeedback('Next guest called'); invalidate(); }, onError: () => setFeedback('No waiting guests to call') }); };
  const markServed = (entry: QueueEntry) => { serve.mutate({ queueId: id, entryId: entry.id }, { onSuccess: () => { setFeedback(`${entry.name} marked served`); invalidate(); } }); };
  const remove = (entry: QueueEntry) => { if (window.confirm(`Remove ${entry.name} from the queue?`)) leave.mutate({ queueId: id, entryId: entry.id }, { onSuccess: () => { setFeedback(`${entry.name} removed`); invalidate(); } }); };
  if (queuesLoading) return <PageShell dark><TopBar dark staff /><LoadingState label="Connecting to your queue" /></PageShell>;
  if (queuesError) return <PageShell dark><TopBar dark staff /><ErrorState retry={retryQueues} title="Staff view is offline" /></PageShell>;
  return <PageShell dark><TopBar dark staff /><main className="mx-auto max-w-[1240px] px-5 pb-20 md:px-8"><div className="flex flex-col justify-between gap-6 border-b border-[#396169] py-10 md:flex-row md:items-end"><div><p className="font-mono text-xs uppercase tracking-[.15em] text-[#9bbcb6]">Today / live operations</p><h1 className="mt-4 text-4xl font-extrabold tracking-[-.06em] md:text-5xl">{queue?.establishmentName ?? 'Your queue'}</h1><p className="mt-3 text-sm text-[#b4ccc8]">A focused view for a line that keeps moving.</p></div><div className="flex items-center gap-3"><StatusPill status={queue?.status ?? 'closed'} /><span className="font-mono text-xs text-[#9bbcb6]">AUTO-REFRESH 5s</span></div></div><div className="grid gap-5 py-8 md:grid-cols-[1.4fr_.8fr]"><section className="rounded-[1.5rem] border border-[#396169] bg-[#214950] p-5 md:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="font-mono text-xs uppercase tracking-[.13em] text-[#9bbcb6]">Line control</p><h2 className="mt-3 text-2xl font-extrabold">Waiting order</h2></div><Button onClick={next} disabled={callNext.isPending || !activeEntries.some((e) => e.status === 'waiting')} className="h-11 rounded-xl bg-[#e5bb5c] text-[#193a41] hover:bg-[#f0ca74]" data-testid="button-call-next"><PhoneCall size={16} /> {callNext.isPending ? 'Calling...' : 'Call next'}</Button></div>{feedback ? <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#315c5f] px-4 py-3 text-xs text-[#d7e5df]" data-testid="status-operation-feedback"><Check size={15} className="text-[#e5bb5c]" />{feedback}</div> : null}<div className="mt-6 overflow-hidden rounded-2xl border border-[#396169]">{entriesLoading ? <div className="space-y-3 p-5"><div className="h-12 animate-pulse rounded-xl bg-[#2b555b]" /><div className="h-12 animate-pulse rounded-xl bg-[#2b555b]" /></div> : entriesError ? <ErrorState retry={retryEntries} title="Line unavailable" /> : activeEntries.length === 0 ? <div className="p-12 text-center"><Sparkles className="mx-auto text-[#e5bb5c]" size={24} /><p className="mt-4 font-bold">The line is clear.</p><p className="mt-2 text-sm text-[#9bbcb6]">New guests will appear here as they join.</p></div> : activeEntries.map((entry, index) => <div key={entry.id} className="flex flex-col gap-4 border-b border-[#396169] bg-[#1d4249] p-4 last:border-0 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-4"><span className="font-mono text-lg text-[#9bbcb6]">{String(index + 1).padStart(2, '0')}</span><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d8e6de] font-bold text-[#315f57]">{entry.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-extrabold">{entry.name}</p><p className="mt-1 font-mono text-[10px] text-[#9bbcb6]">joined {new Date(entry.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div></div><div className="flex items-center gap-2 pl-14 sm:pl-0"><StatusPill status={entry.status} />{entry.status === 'called' ? <Button size="sm" onClick={() => markServed(entry)} disabled={serve.isPending} className="rounded-lg bg-[#d8e6de] text-[#193a41]" data-testid={`button-serve-entry-${entry.id}`}><Check size={14} /> Serve</Button> : null}<Button size="icon" variant="ghost" onClick={() => remove(entry)} disabled={leave.isPending} className="text-[#9bbcb6] hover:text-[#f0b0a8]" data-testid={`button-remove-entry-${entry.id}`}><X size={16} /></Button></div></div>)}</div></section><aside className="space-y-5"><div className="grid grid-cols-2 gap-3">{[{label:'Waiting', value: summary?.waiting ?? queue?.waitingCount ?? 0, icon: Users}, {label:'Called', value: summary?.called ?? activeEntries.filter((e) => e.status === 'called').length, icon: Bell}, {label:'Served today', value: summary?.servedToday ?? 0, icon: Check}, {label:'Avg. wait', value: `${summary?.averageWaitMinutes ?? queue?.averageMinutes ?? 0}m`, icon: Clock3}].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-[#396169] bg-[#214950] p-4"><Icon size={16} className="text-[#e5bb5c]" /><p className="mt-5 font-mono text-2xl">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#9bbcb6]">{label}</p></div>)}</div><div className="rounded-[1.5rem] border border-[#396169] bg-[#214950] p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-extrabold">Recent activity</h2><MoreHorizontal size={17} className="text-[#9bbcb6]" /></div><div className="mt-3">{summary?.recentActivity?.length ? summary.recentActivity.slice(0, 5).map((activity) => <ActivityRow key={activity.id} activity={activity} />) : <p className="py-8 text-center text-sm text-[#9bbcb6]">Activity will show as the line moves.</p>}</div></div></aside></div><footer className="flex flex-col justify-between gap-3 border-t border-[#396169] pt-6 text-xs text-[#9bbcb6] sm:flex-row"><span>Queue staff console</span><span className="font-mono">Keep the room moving, one guest at a time.</span></footer></main></PageShell>;
}

export { PublicQueuePage, JoinPage, TicketPage, StaffPage };