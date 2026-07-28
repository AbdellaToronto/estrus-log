"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  FlaskConical,
  GitBranch,
  LayoutGrid,
  ListTree,
  LockKeyhole,
  Map,
  Microscope,
  Route,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WORKFLOW_CONNECTIONS,
  WORKFLOW_FLOWS,
  WORKFLOW_STEPS,
  type WorkflowAuditState,
  type WorkflowFlow,
  type WorkflowStep,
  workflowFlow,
} from "@/lib/workflow-lab";

type WorkflowNode = Node<
  { step: WorkflowStep; flow: WorkflowFlow },
  "workflowStep"
>;

const auditStateMeta: Record<
  WorkflowAuditState,
  { label: string; className: string; icon: typeof CircleDot }
> = {
  mapped: {
    label: "Mapped · audit pending",
    className: "bg-sky-50 text-sky-800 ring-sky-200",
    icon: CircleDot,
  },
  attention: {
    label: "Priority audit state",
    className: "bg-amber-50 text-amber-900 ring-amber-200",
    icon: AlertTriangle,
  },
  boundary: {
    label: "External / manual boundary",
    className: "bg-violet-50 text-violet-900 ring-violet-200",
    icon: LockKeyhole,
  },
  gap: {
    label: "Known product gap",
    className: "bg-rose-50 text-rose-900 ring-rose-200",
    icon: ShieldAlert,
  },
};

function WorkflowStepNode({ data, selected }: NodeProps<WorkflowNode>) {
  const { step, flow } = data;
  const status = auditStateMeta[step.auditState];
  const StatusIcon = status.icon;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white"
        style={{ background: flow.accent }}
      />
      <article
        data-testid={`workflow-step-${step.id}`}
        className={cn(
          "w-[326px] rounded-2xl border bg-white p-4 shadow-lg shadow-slate-950/5 transition",
          selected
            ? "border-slate-900 ring-4 ring-slate-900/10"
            : "border-slate-200"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: flow.accent }}
            >
              {flow.shortName} · {step.order}
            </p>
            <h2 className="mt-1 text-[15px] font-semibold leading-5 text-slate-950">
              {step.title}
            </h2>
          </div>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ background: flow.accent }}
            aria-hidden="true"
          >
            {step.surface === "CLI / evaluation" ? (
              <Microscope className="h-4 w-4" />
            ) : (
              <Route className="h-4 w-4" />
            )}
          </span>
        </div>

        <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">
          {step.userSees}
        </p>

        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Primary action
          </p>
          <p className="mt-0.5 text-xs font-medium leading-4 text-slate-800">
            {step.primaryAction}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset",
              status.className
            )}
          >
            <StatusIcon className="h-3 w-3" aria-hidden="true" />
            {status.label}
          </span>
          <span className="max-w-[108px] truncate font-mono text-[9px] text-slate-500">
            {step.route ?? "evaluation tool"}
          </span>
        </div>
      </article>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white"
        style={{ background: flow.accent }}
      />
    </>
  );
}

const nodeTypes = { workflowStep: WorkflowStepNode };

function flowNodes(steps: WorkflowStep[]): WorkflowNode[] {
  const visibleFlowIds = new Set(steps.map((step) => step.flowId));
  const isFocusedFlow = visibleFlowIds.size === 1;

  return steps.map((step) => {
    const flowIndex = WORKFLOW_FLOWS.findIndex((flow) => flow.id === step.flowId);
    return {
      id: step.id,
      type: "workflowStep",
      position: {
        x: (step.order - 1) * 390,
        y: isFocusedFlow ? 0 : flowIndex * 356,
      },
      data: { step, flow: workflowFlow(step.flowId) },
      draggable: false,
      connectable: false,
      selectable: true,
    };
  });
}

function flowEdges(steps: WorkflowStep[]): Edge[] {
  const visible = new Set(steps.map((step) => step.id));
  return WORKFLOW_CONNECTIONS.filter(
    (connection) => visible.has(connection.source) && visible.has(connection.target)
  ).map((connection) => {
    const sourceStep = WORKFLOW_STEPS.find(
      (step) => step.id === connection.source
    );
    const flow = workflowFlow(sourceStep?.flowId ?? "lab-entry");
    return {
      id: `${connection.source}-${connection.target}`,
      source: connection.source,
      target: connection.target,
      label: connection.label,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: flow.accent },
      style: { stroke: flow.accent, strokeWidth: 2 },
      labelStyle: { fill: "#475569", fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.94 },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 7,
    };
  });
}

function AuditBadge({ state }: { state: WorkflowAuditState }) {
  const status = auditStateMeta[state];
  const Icon = status.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        status.className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {status.label}
    </span>
  );
}

export function WorkflowCanvas() {
  const [activeFlow, setActiveFlow] = useState<string>("all");
  const [view, setView] = useState<"canvas" | "outline">("canvas");
  const visibleSteps = useMemo(
    () =>
      activeFlow === "all"
        ? WORKFLOW_STEPS
        : WORKFLOW_STEPS.filter((step) => step.flowId === activeFlow),
    [activeFlow]
  );
  const [selectedId, setSelectedId] = useState(WORKFLOW_STEPS[0].id);
  const selectedStep =
    visibleSteps.find((step) => step.id === selectedId) ?? visibleSteps[0];
  const selectedFlow = workflowFlow(selectedStep.flowId);
  const nodes = useMemo(() => flowNodes(visibleSteps), [visibleSteps]);
  const edges = useMemo(() => flowEdges(visibleSteps), [visibleSteps]);
  const attentionCount = WORKFLOW_STEPS.filter(
    (step) => step.auditState === "attention"
  ).length;
  const gapCount = WORKFLOW_STEPS.filter(
    (step) => step.auditState === "gap"
  ).length;

  const chooseFlow = (flowId: string) => {
    setActiveFlow(flowId);
    const first =
      flowId === "all"
        ? WORKFLOW_STEPS[0]
        : WORKFLOW_STEPS.find((step) => step.flowId === flowId);
    if (first) setSelectedId(first.id);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 text-slate-950">
      <header className="relative z-20 border-b border-white/10 bg-slate-950 px-5 py-4 text-white shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/25">
              <Map className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">Estrus workflow lab</h1>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  local only
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                A journey-level test contract: pages, dialogs, manual boundaries,
                data writes, known gaps, and the assertions each state must satisfy.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <strong className="text-white">{WORKFLOW_FLOWS.length}</strong>{" "}
              <span className="text-slate-400">journeys</span>
            </span>
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <strong className="text-white">{WORKFLOW_STEPS.length}</strong>{" "}
              <span className="text-slate-400">states</span>
            </span>
            <span className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-amber-200">
              <strong>{attentionCount}</strong> priority audits
            </span>
            <span className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-rose-200">
              <strong>{gapCount}</strong> known gap
            </span>
            <div className="ml-1 flex rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                aria-pressed={view === "canvas"}
                onClick={() => setView("canvas")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium",
                  view === "canvas" ? "bg-white text-slate-950" : "text-slate-300"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Canvas
              </button>
              <button
                type="button"
                aria-pressed={view === "outline"}
                onClick={() => setView("outline")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium",
                  view === "outline" ? "bg-white text-slate-950" : "text-slate-300"
                )}
              >
                <ListTree className="h-3.5 w-3.5" /> Outline
              </button>
            </div>
          </div>
        </div>

        <nav aria-label="Filter workflow journeys" className="mt-4 flex gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            aria-pressed={activeFlow === "all"}
            onClick={() => chooseFlow("all")}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
              activeFlow === "all"
                ? "bg-white text-slate-950 ring-white"
                : "bg-white/5 text-slate-300 ring-white/15 hover:bg-white/10"
            )}
          >
            All journeys
          </button>
          {WORKFLOW_FLOWS.map((flow) => (
            <button
              key={flow.id}
              type="button"
              aria-pressed={activeFlow === flow.id}
              onClick={() => chooseFlow(flow.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
                activeFlow === flow.id
                  ? "bg-white text-slate-950 ring-white"
                  : "bg-white/5 text-slate-300 ring-white/15 hover:bg-white/10"
              )}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{ background: flow.accent }}
                aria-hidden="true"
              />
              {flow.shortName}
            </button>
          ))}
        </nav>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-100"
          data-testid="workflow-map-region"
        >
          {view === "canvas" ? (
            <div className="absolute inset-0" data-testid="workflow-canvas">
              <ReactFlow
                key={activeFlow}
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodeClick={(_, node) => setSelectedId(node.id)}
                fitView
                fitViewOptions={{ padding: 0.12, maxZoom: activeFlow === "all" ? 0.48 : 0.84 }}
                minZoom={0.18}
                maxZoom={1.35}
                nodesDraggable={false}
                nodesConnectable={false}
                proOptions={{ hideAttribution: true }}
                aria-label="Estrus user journey canvas"
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={18}
                  size={1.25}
                  color="#cbd5e1"
                />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(node) =>
                    (node.data as WorkflowNode["data"]).flow.accent
                  }
                  maskColor="rgb(15 23 42 / 0.08)"
                  className="!border !border-slate-200 !bg-white/90 !shadow-lg"
                />
                <Controls
                  showInteractive={false}
                  className="!overflow-hidden !rounded-xl !border !border-slate-200 !bg-white !shadow-lg"
                />
              </ReactFlow>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-5" data-testid="workflow-outline">
              <div className="mx-auto max-w-6xl space-y-6">
                {(activeFlow === "all"
                  ? WORKFLOW_FLOWS
                  : WORKFLOW_FLOWS.filter((flow) => flow.id === activeFlow)
                ).map((flow) => {
                  const steps = visibleSteps.filter((step) => step.flowId === flow.id);
                  return (
                    <section key={flow.id} aria-labelledby={`outline-${flow.id}`}>
                      <div className="mb-3 flex items-end justify-between gap-4">
                        <div>
                          <p
                            className="text-xs font-bold uppercase tracking-[0.14em]"
                            style={{ color: flow.accent }}
                          >
                            {steps.length} states
                          </p>
                          <h2 id={`outline-${flow.id}`} className="mt-1 text-xl font-semibold">
                            {flow.name}
                          </h2>
                          <p className="mt-1 text-sm text-slate-600">{flow.userGoal}</p>
                        </div>
                      </div>
                      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {steps.map((step) => (
                          <li key={step.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(step.id)}
                              className={cn(
                                "h-full w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-400 hover:shadow-md",
                                selectedStep.id === step.id
                                  ? "border-slate-900 ring-4 ring-slate-900/10"
                                  : "border-slate-200"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold" style={{ color: flow.accent }}>
                                  {step.order}. {step.title}
                                </span>
                                <AuditBadge state={step.auditState} />
                              </div>
                              <p className="mt-3 text-xs leading-5 text-slate-600">{step.userSees}</p>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        <aside
          className="relative z-10 hidden w-[390px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white xl:block"
          aria-label="Selected workflow state details"
          data-testid="workflow-inspector"
        >
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: selectedFlow.accent }}>
                {selectedFlow.shortName} · Step {selectedStep.order}
              </p>
              <AuditBadge state={selectedStep.auditState} />
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">{selectedStep.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{selectedStep.userSees}</p>
          </div>

          <div className="space-y-6 p-5 text-sm">
            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                <GitBranch className="h-4 w-4" /> Journey contract
              </h3>
              <dl className="mt-3 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-semibold text-slate-500">Primary action</dt>
                  <dd className="mt-1 font-medium text-slate-900">{selectedStep.primaryAction}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-semibold text-slate-500">Expected outcome</dt>
                  <dd className="mt-1 leading-5 text-slate-700">{selectedStep.outcome}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                <CheckCircle2 className="h-4 w-4" /> Test assertions
              </h3>
              <ul className="mt-3 space-y-2">
                {selectedStep.assertions.map((assertion) => (
                  <li key={assertion} className="flex gap-2 rounded-xl border border-slate-200 p-3 leading-5 text-slate-700">
                    <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    {assertion}
                  </li>
                ))}
              </ul>
            </section>

            {selectedStep.writes && (
              <section>
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  <FlaskConical className="h-4 w-4" /> Writes or artifacts
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedStep.writes.map((write) => (
                    <code key={write} className="rounded-lg bg-indigo-50 px-2 py-1 text-xs text-indigo-800">
                      {write}
                    </code>
                  ))}
                </div>
              </section>
            )}

            {selectedStep.auditNote && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-900">
                  <AlertTriangle className="h-4 w-4" /> Audit note
                </h3>
                <p className="mt-2 leading-6 text-amber-950">{selectedStep.auditNote}</p>
              </section>
            )}

            <section className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-500">Surface</p>
                  <p className="mt-1 text-slate-800">{selectedStep.surface}</p>
                </div>
                {selectedStep.route && !selectedStep.route.includes("[") ? (
                  <Link
                    href={selectedStep.route}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-3 py-2 font-semibold text-white"
                  >
                    Open route <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <code className="rounded-lg bg-slate-100 px-2 py-1.5 text-slate-600">
                    {selectedStep.route ?? "outside the app"}
                  </code>
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
