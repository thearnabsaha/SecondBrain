import { CapturePanel } from "../_components/CapturePanel";

const examples = [
  "Met Aarav at the gym today. He works at TCS, doesn't smoke, and seems super disciplined about his routine. Mentioned his girlfriend Maya is a doctor.",
  "Riya is Aarav's cousin. She's into climbing and photography. Studying at IIT Bombay.",
  "Caught up with Maya — she's switched hospitals, now at AIIMS. Loves dogs. Vegetarian.",
  "Karthik is my new manager at work. Lives in Bangalore. Plays guitar on weekends.",
];

export default function CapturePage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Capture</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop in messy notes about people you know. The system will extract,
          connect, and remember.
        </p>
      </div>

      <CapturePanel examples={examples} />
    </>
  );
}
