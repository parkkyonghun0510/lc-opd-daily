import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PrintDialogProps {
    onPrint: (options: PrintOptions) => void;
    disabled?: boolean;
}

interface PrintOptions {
    includeAnalytics: boolean;
    includeComments: boolean;
}

export function PrintDialog({ onPrint, disabled }: PrintDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<PrintOptions>({
        includeAnalytics: true,
        includeComments: true,
    });

    const handlePrint = () => {
        onPrint(options);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={disabled}
                >
                    <Printer className="h-4 w-4" />
                    <span className="hidden sm:inline">Print</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Print Reports</DialogTitle>
                    <DialogDescription>
                        Configure what information to include in the printed report.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="analytics" className="flex flex-col space-y-1">
                            <span>Include Analytics</span>
                            <span className="font-normal text-xs text-muted-foreground">
                                Add trend analysis and performance metrics
                            </span>
                        </Label>
                        <Switch
                            id="analytics"
                            checked={options.includeAnalytics}
                            onCheckedChange={(checked) =>
                                setOptions((prev) => ({ ...prev, includeAnalytics: checked }))
                            }
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="comments" className="flex flex-col space-y-1">
                            <span>Include Comments</span>
                            <span className="font-normal text-xs text-muted-foreground">
                                Add report comments and discussion history
                            </span>
                        </Label>
                        <Switch
                            id="comments"
                            checked={options.includeComments}
                            onCheckedChange={(checked) =>
                                setOptions((prev) => ({ ...prev, includeComments: checked }))
                            }
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handlePrint}>
                        Print Report
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}