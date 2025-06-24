import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pageNumbers = [];

    // Always show first page
    pageNumbers.push(1);

    // Calculate start and end of the pagination range
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    // Add ellipsis if needed before the range
    if (startPage > 2) {
      pageNumbers.push("ellipsis-start");
    }

    // Add the range of pages
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    // Add ellipsis if needed after the range
    if (endPage < totalPages - 1) {
      pageNumbers.push("ellipsis-end");
    }

    // Always show last page if more than 1 page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }

    return pageNumbers;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav
      aria-label="Pagination"
      className="inline-flex flex-wrap items-center justify-center gap-1"
    >
      {/* Previous button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous page</span>
      </Button>

      {/* Page numbers */}
      {pageNumbers.map((page, index) => {
        if (page === "ellipsis-start" || page === "ellipsis-end") {
          return (
            <Button
              key={`ellipsis-${index}`}
              variant="outline"
              size="icon"
              disabled
              className="h-8 w-8"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More pages</span>
            </Button>
          );
        }

        return (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="icon"
            onClick={() => onPageChange(page as number)}
            className="h-8 w-8"
          >
            {page}
            <span className="sr-only">Page {page}</span>
          </Button>
        );
      })}

      {/* Next button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next page</span>
      </Button>
    </nav>
  );
}
