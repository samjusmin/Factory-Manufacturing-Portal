// What is still to do on a FAT unit? Shared by the API (which sends the summaries) and the frontend, so the unit
// list, the unit page and the Home card all count checks the same way.
//
// A check is "done" when it is Complete or N/A (the same rule the progress figure uses). Section headings
// (reference "Heading") are not checks and are never counted. A check marked Incomplete has been looked at and
// failed; an unanswered one has simply not been reached yet.

export interface IFatCheckLike {
  description?: string;
  reference?: string | null;
  status?: string | null;
  comment?: string | null;
}

export interface IFatCategoryLike {
  name: string;
  checklists?: IFatCheckLike[];
}

export interface IOutstandingCheck {
  category: string;
  description: string;
  // 'Incomplete' (failed) or null (not answered yet).
  status: string | null;
  comment: string | null;
}

export interface IFatCheckCounts {
  total: number;
  complete: number;
  notApplicable: number;
  failed: number;
  unanswered: number;
  // failed + unanswered: everything that still stops the unit being finished.
  outstanding: number;
}

export interface IFatCheckSummary extends IFatCheckCounts {
  // Failed checks first, then unanswered ones, each in checklist order.
  items: IOutstandingCheck[];
}

export function isFatHeading(check: IFatCheckLike): boolean {
  return check.reference === 'Heading';
}

export function summariseFatChecks(categories: IFatCategoryLike[] | null | undefined): IFatCheckSummary {
  const failedItems: IOutstandingCheck[] = [];
  const unansweredItems: IOutstandingCheck[] = [];
  let total = 0;
  let complete = 0;
  let notApplicable = 0;

  (categories || []).forEach(category => {
    (category.checklists || []).filter(c => !isFatHeading(c)).forEach(check => {
      total++;
      if (check.status === 'Complete') {
        complete++;
      } else if (check.status === 'N/A') {
        notApplicable++;
      } else {
        const item: IOutstandingCheck = {
          category: category.name,
          description: check.description || '',
          status: check.status === 'Incomplete' ? 'Incomplete' : null,
          comment: check.comment || null,
        };
        (item.status ? failedItems : unansweredItems).push(item);
      }
    });
  });

  return {
    total,
    complete,
    notApplicable,
    failed: failedItems.length,
    unanswered: unansweredItems.length,
    outstanding: failedItems.length + unansweredItems.length,
    items: failedItems.concat(unansweredItems),
  };
}

// The counts without the list, for lists of many units.
export function fatCheckCounts(summary: IFatCheckSummary): IFatCheckCounts {
  const { items, ...counts } = summary;
  return counts;
}
