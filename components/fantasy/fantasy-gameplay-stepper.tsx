"use client"

import { useTranslations } from "next-intl"
import { Check, Lock, PenTool, PlayCircle, Trophy, UserCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { FantasyBootstrapResponse, FantasyReviewResponse } from "@/lib/fantasy/types"

interface Props {
  bootstrap: FantasyBootstrapResponse | null
  review: FantasyReviewResponse | null
}

export function FantasyGameplayStepper({ bootstrap, review }: Props) {
  const t = useTranslations("fantasy.draft")

  const lockStatus = bootstrap?.lockStatus ?? "open"
  const isLocked = lockStatus === "locked" || lockStatus === "finished"
  const isFinished = lockStatus === "finished"

  const lineupValid = review
    ? review.eligibility.hasDriver1 &&
      review.eligibility.hasDriver2 &&
      review.eligibility.hasTeam &&
      review.eligibility.hasEngineer &&
      review.eligibility.budgetValid
    : false
  const predictionsComplete = review?.predictions.isComplete ?? false

  let activeStep = 0
  if (isFinished) {
    activeStep = 4
  } else if (isLocked) {
    activeStep = 3
  } else if (!lineupValid) {
    activeStep = 0
  } else if (!predictionsComplete) {
    activeStep = 1
  } else {
    activeStep = 2
  }

  const steps = [
    {
      key: "stepperDraft",
      icon: UserCheck,
    },
    {
      key: "stepperPredictions",
      icon: PenTool,
    },
    {
      key: "stepperLock",
      icon: Lock,
    },
    {
      key: "stepperOngoing",
      icon: PlayCircle,
    },
    {
      key: "stepperResults",
      icon: Trophy,
    },
  ]

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-50">
      <CardContent className="p-4 sm:p-6">
        <div className="relative flex items-center justify-between">
          {/* Progress bar background line */}
          <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-zinc-800" aria-hidden="true" />
          
          {/* Active progress bar line */}
          <div
            className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-red-600 transition-all duration-500 ease-in-out"
            style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
            aria-hidden="true"
          />

          {steps.map((step, idx) => {
            const Icon = step.icon
            const isCompleted = idx < activeStep
            const isActive = idx === activeStep
            
            return (
              <div key={step.key} className="relative flex flex-col items-center z-10">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-350 ${
                    isCompleted
                      ? "border-red-600 bg-red-600 text-white"
                      : isActive
                      ? "border-red-500 bg-zinc-900 text-red-400 ring-4 ring-red-500/20 scale-110"
                      : "border-zinc-800 bg-zinc-950 text-zinc-500"
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4 stroke-[3px]" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block ${
                      isActive ? "text-red-400 font-black" : isCompleted ? "text-zinc-300" : "text-zinc-600"
                    }`}
                  >
                    {t(step.key)}
                  </div>
                  <div
                    className={`text-[9px] sm:hidden ${
                      isActive ? "text-red-400 font-bold" : isCompleted ? "text-zinc-400" : "text-zinc-600"
                    }`}
                  >
                    {t(step.key)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
