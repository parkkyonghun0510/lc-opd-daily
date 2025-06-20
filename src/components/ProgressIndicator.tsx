import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ProgressIndicatorProps {
  progress: number;
  message?: string;
  isOpen: boolean;
}

export function ProgressIndicator({
  progress,
  message,
  isOpen,
}: ProgressIndicatorProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]">
        <div className="grid gap-4 py-4">
          <div className="space-y-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-center text-muted-foreground">
              {message || `Processing... ${progress}%`}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
