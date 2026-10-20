export type ProgressRow = {
  person: string;
  department: string;
  lessons: string;
  assessments: string;
  assignments: string;
};

export const sampleProgressRows: ProgressRow[] = [
  {
    person: "Test Learner Content",
    department: "Content",
    lessons: "3 of 12",
    assessments: "1 of 4",
    assignments: "0 of 2",
  },
  {
    person: "Test Learner Creative",
    department: "Creative",
    lessons: "8 of 12",
    assessments: "2 of 4",
    assignments: "1 of 2",
  },
  {
    person: "Test Learner Performance",
    department: "Performance",
    lessons: "1 of 12",
    assessments: "0 of 4",
    assignments: "0 of 2",
  },
  {
    person: "Test Learner Accounts",
    department: "Account Management",
    lessons: "6 of 12",
    assessments: "3 of 4",
    assignments: "2 of 2",
  },
  {
    person: "Test Learner Leadership",
    department: "Senior Management",
    lessons: "4 of 12",
    assessments: "1 of 4",
    assignments: "1 of 2",
  },
];
