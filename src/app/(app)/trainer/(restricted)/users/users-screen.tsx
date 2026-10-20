"use client";

import { useMemo, useState } from "react";
import { DataTable, type DataColumn, type DataFilter, type QuickFilter } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import {
  isSetupPending,
  type CohortRecord,
  type DepartmentOption,
  type PersonRecord,
} from "@/lib/people/types";
import { appRoleValues, pathwayNames, roleNames, scopeNames, streamNames, streamValues } from "@/lib/people/labels";
import { BulkActions } from "./bulk-actions";
import { CohortsPanel } from "./cohorts-panel";
import { PersonEditSheet } from "./person-edit-sheet";

export type PersonRow = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  scope: string;
  stream: string;
  pathway: string;
  cohort: string;
  active: string;
  firstSignIn: string;
  firstSignInSort: string;
  lastSeen: string;
  lastSeenSort: string;
  pending: string;
};

const columns: DataColumn<PersonRow>[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "department", header: "Department" },
  { key: "role", header: "Role" },
  { key: "scope", header: "Progress scope" },
  { key: "stream", header: "Stream" },
  { key: "pathway", header: "Specialist pathway" },
  { key: "cohort", header: "Cohort" },
  { key: "active", header: "Active" },
  { key: "firstSignIn", header: "First sign-in", sortKey: "firstSignInSort" },
  { key: "lastSeen", header: "Last seen", sortKey: "lastSeenSort" },
];

const quickFilters: QuickFilter<PersonRow>[] = [{ label: "Set-up pending", matches: (row) => row.pending === "yes" }];

function toRow(person: PersonRecord): PersonRow {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    department: person.departmentName ?? "",
    role: roleNames[person.role],
    scope: scopeNames[person.scope],
    stream: person.stream ? streamNames[person.stream] : "",
    pathway: person.pathway ? pathwayNames[person.pathway] : "",
    cohort: person.cohortName ?? "",
    active: person.isActive ? "Yes" : "No",
    firstSignIn: formatDate(person.firstSignInAt),
    firstSignInSort: person.firstSignInAt,
    lastSeen: person.lastSeenAt ? formatDate(person.lastSeenAt) : "Not yet",
    lastSeenSort: person.lastSeenAt ?? "",
    pending: isSetupPending(person) ? "yes" : "",
  };
}

export function UsersScreen({
  people,
  departments,
  cohorts,
  currentUserId,
  isAdmin,
}: {
  people: PersonRecord[];
  departments: DepartmentOption[];
  cohorts: CohortRecord[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = useMemo(() => people.map(toRow), [people]);
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const editing = editingId ? (peopleById.get(editingId) ?? null) : null;
  const selectedPeople = [...selected].flatMap((id) => peopleById.get(id) ?? []);

  const filters = useMemo<DataFilter<PersonRow>[]>(
    () => [
      { key: "department", label: "Department" },
      { key: "role", label: "Role", options: appRoleValues.map((role) => roleNames[role]) },
      { key: "stream", label: "Stream", options: ["", ...streamValues.map((stream) => streamNames[stream])] },
      { key: "cohort", label: "Cohort" },
      { key: "active", label: "Active", options: ["Yes", "No"] },
    ],
    [],
  );

  const cohortMembers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of people) {
      if (person.cohortId) {
        counts.set(person.cohortId, (counts.get(person.cohortId) ?? 0) + 1);
      }
    }
    return counts;
  }, [people]);

  return (
    <Tabs defaultValue="people">
      <TabsList>
        <TabsTrigger value="people">People</TabsTrigger>
        <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
      </TabsList>
      <TabsContent value="people" className="space-y-6 pt-2">
        <Counts people={people} />
        <BulkActions
          selectedPeople={selectedPeople}
          departments={departments}
          cohorts={cohorts}
          onDone={() => setSelected(new Set())}
          onClear={() => setSelected(new Set())}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey="id"
          caption="Everyone who has signed in. Tick people to change several at once."
          exportFileName="cds-ai-academy-people.csv"
          filters={filters}
          quickFilters={quickFilters}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          rowLabel={(row) => row.name}
          rowActions={(row) => (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(row.id)}>
              Edit<span className="sr-only"> {row.name}</span>
            </Button>
          )}
          emptyMessage="No one matches these filters. People appear here after their first sign-in."
        />
        <PersonEditSheet
          person={editing}
          departments={departments}
          cohorts={cohorts}
          isSelf={editing?.id === currentUserId}
          canPauseAdmins={isAdmin}
          onClose={() => setEditingId(null)}
        />
      </TabsContent>
      <TabsContent value="cohorts" className="pt-2">
        <CohortsPanel cohorts={cohorts} memberCounts={cohortMembers} />
      </TabsContent>
    </Tabs>
  );
}

function Counts({ people }: { people: PersonRecord[] }) {
  const active = people.filter((person) => person.isActive).length;
  const pending = people.filter(isSetupPending).length;
  const byDepartment = new Map<string, number>();
  for (const person of people) {
    const name = person.departmentName ?? "No department";
    byDepartment.set(name, (byDepartment.get(name) ?? 0) + 1);
  }
  const departmentCounts = [...byDepartment.entries()].sort(([left], [right]) => {
    if (left === "No department") return 1;
    if (right === "No department") return -1;
    return left.localeCompare(right, "en");
  });

  const totals = [
    { label: "People", value: people.length },
    { label: "Set-up pending", value: pending },
    { label: "Active", value: active },
    { label: "Inactive", value: people.length - active },
  ];

  return (
    <section aria-labelledby="people-counts" className="space-y-3">
      <h2 id="people-counts" className="sr-only">
        Counts
      </h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {totals.map((total) => (
          <Card key={total.label} size="sm">
            <CardContent className="space-y-1">
              <dt className="text-sm text-muted-foreground">{total.label}</dt>
              <dd className="text-2xl font-medium text-heading">{total.value}</dd>
            </CardContent>
          </Card>
        ))}
      </dl>
      <Card size="sm">
        <CardHeader>
          <CardTitle>People per department</CardTitle>
        </CardHeader>
        <CardContent>
          {departmentCounts.length === 0 ? (
            <p className="text-muted-foreground">No one has signed in yet.</p>
          ) : (
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {departmentCounts.map(([name, count]) => (
                <div key={name} className="flex justify-between gap-4 border-b border-border/60 py-1">
                  <dt>{name}</dt>
                  <dd className="font-medium tabular-nums">{count}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
