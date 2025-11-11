import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type OnboardingStepperProps = {
  currentStep: number;
  steps: string[];
};

export const OnboardingStepper = ({ currentStep, steps }: OnboardingStepperProps) => {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((step, stepIdx) => (
          <li key={step} className={cn("relative", stepIdx !== steps.length - 1 ? "flex-1" : "")}>
            <div className="relative z-10 flex items-center bg-gray-50/50 pr-2">
              <span className="flex h-9 items-center">
                {stepIdx < currentStep ? (
                  // Completed Step
                  <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-green-600 group-hover:bg-green-800">
                    <Check className="h-5 w-5 text-white" aria-hidden="true" />
                  </span>
                ) : stepIdx === currentStep ? (
                  // Current Step
                  <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-red-600 bg-white">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                  </span>
                ) : (
                  // Upcoming Step
                  <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white group-hover:border-gray-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-transparent group-hover:bg-gray-300" />
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "ml-4 hidden text-sm font-medium md:inline-block",
                  stepIdx === currentStep ? "text-red-600" : "text-gray-900",
                  stepIdx > currentStep && "text-gray-500"
                )}
              >
                {step}
              </span>
            </div>

            {/* Connector */}
            {stepIdx < steps.length - 1 ? (
              <div className="absolute inset-0 top-4 left-4 -ml-px mt-0.5 h-0.5 w-full bg-gray-300" aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
};