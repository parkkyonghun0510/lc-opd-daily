import { useReducer } from "react";

export interface FilterState {
  searchTerm: string;
  branchFilter: string;
  reportTypeFilter: string;
  statusFilter: string;
  sortField: string;
  sortDirection: "asc" | "desc";
  dateRange: {
    from?: Date;
    to?: Date;
  };
  currentPage: number;
}

type FilterAction =
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_BRANCH_FILTER"; payload: string }
  | { type: "SET_REPORT_TYPE_FILTER"; payload: string }
  | { type: "SET_STATUS_FILTER"; payload: string }
  | { type: "SET_SORT_FIELD"; payload: string }
  | { type: "TOGGLE_SORT_DIRECTION" }
  | { type: "SET_DATE_RANGE"; payload: { from?: Date; to?: Date } }
  | { type: "SET_PAGE"; payload: number }
  | { type: "RESET_FILTERS" };

const initialState: FilterState = {
  searchTerm: "",
  branchFilter: "all",
  reportTypeFilter: "all",
  statusFilter: "pending_approval",
  sortField: "date",
  sortDirection: "desc",
  dateRange: {},
  currentPage: 1,
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_SEARCH":
      return { ...state, searchTerm: action.payload, currentPage: 1 };
    case "SET_BRANCH_FILTER":
      return { ...state, branchFilter: action.payload, currentPage: 1 };
    case "SET_REPORT_TYPE_FILTER":
      return { ...state, reportTypeFilter: action.payload, currentPage: 1 };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.payload, currentPage: 1 };
    case "SET_SORT_FIELD":
      return { ...state, sortField: action.payload };
    case "TOGGLE_SORT_DIRECTION":
      return {
        ...state,
        sortDirection: state.sortDirection === "asc" ? "desc" : "asc",
      };
    case "SET_DATE_RANGE":
      return { ...state, dateRange: action.payload, currentPage: 1 };
    case "SET_PAGE":
      return { ...state, currentPage: action.payload };
    case "RESET_FILTERS":
      return initialState;
    default:
      return state;
  }
}

export function useApprovalFilterReducer() {
  const [state, dispatch] = useReducer(filterReducer, initialState);

  return {
    state,
    setSearch: (term: string) =>
      dispatch({ type: "SET_SEARCH", payload: term }),
    setBranchFilter: (branch: string) =>
      dispatch({ type: "SET_BRANCH_FILTER", payload: branch }),
    setReportTypeFilter: (type: string) =>
      dispatch({ type: "SET_REPORT_TYPE_FILTER", payload: type }),
    setStatusFilter: (status: string) =>
      dispatch({ type: "SET_STATUS_FILTER", payload: status }),
    setSortField: (field: string) =>
      dispatch({ type: "SET_SORT_FIELD", payload: field }),
    toggleSortDirection: () => dispatch({ type: "TOGGLE_SORT_DIRECTION" }),
    setDateRange: (range: { from?: Date; to?: Date }) =>
      dispatch({ type: "SET_DATE_RANGE", payload: range }),
    setPage: (page: number) => dispatch({ type: "SET_PAGE", payload: page }),
    resetFilters: () => dispatch({ type: "RESET_FILTERS" }),
  };
}
