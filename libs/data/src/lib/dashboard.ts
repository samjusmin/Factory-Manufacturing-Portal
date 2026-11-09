// Each section is only present when the signed-in user holds the area it belongs to: production, receiving, orders and
// inventory need the warehouse area, fat needs the fat area, training is for admins.
export interface IDashboardSummary {
    // open = released orders not yet completed; overdue = open orders past their due date.
    production?: { open: number, inProgress: number, overdue: number };
    // Receiving: released orders with lines still to receive. Orders: every order not yet fully received.
    // overdue and dueThisWeek count those orders by due date.
    receiving?: { open: number, openLines: number, overdue: number, dueThisWeek: number };
    orders?: { open: number, openLines: number, overdue: number, dueThisWeek: number };
    // lowStock counts items at or below their reorder point (it includes outOfStock).
    inventory?: { skus: number, lowStock: number, outOfStock: number };
    // attention: units the signed-in user can see that have at least one failed (Incomplete) check, and how many
    // failed checks that is in all.
    fat?: { total: number, inProgress: number, complete: number, attention: { units: number, failedChecks: number } };
    // Only present for admins, matching the admin-only training register.
    // people holds at least one role; expired / dueSoon / missing count required modules across all of them.
    training?: { people: number, expired: number, dueSoon: number, missing: number };
}
