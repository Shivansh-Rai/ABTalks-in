"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getClaudeSharePrompt,
  getClaudeSharePromptTitle,
  type ClaudeSharePromptKey,
} from "@/lib/claude-linkedin-prompts";

interface Props {
  open: boolean;
  day: ClaudeSharePromptKey;
  onOpenChange: (open: boolean) => void;
}

export function ClaudeSharePromptDialog({ open, day, onOpenChange }: Props) {
  const [copied, setCopied] = useState(false);
  const title = getClaudeSharePromptTitle(day);
  const prompt = getClaudeSharePrompt(day);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Prompt copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy prompt");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(90vh,36rem)] w-full max-w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-lg"
      >
        <DialogHeader className="shrink-0 gap-2 pr-8">
          <DialogTitle className="text-left text-base leading-snug font-semibold">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/40 p-3">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
            {prompt}
          </pre>
        </div>

        <div className="shrink-0 pt-1">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy prompt
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
