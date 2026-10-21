export type CohortBreak = {
  startDate: string;
  weeks: number;
  label: string;
};

export type ProgrammeWeekState =
  | { kind: "before_start"; week0StartDate: string }
  | { kind: "break"; label: string; breakStartDate: string }
  | { kind: "week"; programmeWeek: number; weekMonday: string; weekFriday: string };
