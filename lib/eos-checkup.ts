import "server-only";

/**
 * The 20-point EOS Organizational Checkup — scored 1 (weak) to 5 (strong) each, so the total is a 0–100 percentage.
 * Shared by the portal's self-scoring tool (components/portal) and each workspace's saved Checkup (EOS → Checkup).
 * Server-only on purpose: the portal treats it as content behind its access token, so it reaches the client only as
 * props from a page that has checked access.
 *
 * The order is part of the data: a saved checkup's answers follow it. Reword a statement in place; never reorder.
 */
export const EOS_CHECKUP_STATEMENTS = [
  "We have a clear vision in writing that has been properly communicated and is shared by everyone.",
  "Our core values are clear, and we are hiring, reviewing, rewarding, and firing around them.",
  "Our core business is clear, and our systems and processes reflect that.",
  "Our 10-Year Target is clear and has been communicated to everyone.",
  "Our target market is clear, and our sales and marketing efforts are focused on it.",
  "Our differentiators are clear, and all of our sales and marketing efforts communicate them.",
  "We have a proven process for doing business with our customers. It has been named and visually illustrated, and everyone is adhering to it.",
  "All of the people in our organization are the right people.",
  "Our accountability chart is clear, complete, and constantly updated.",
  "Everyone is in the right seat.",
  "Our leadership team is open and honest, and demonstrates a high level of trust.",
  "Everyone has Rocks and is focused on them (3 to 7 priorities per quarter).",
  "Everyone is engaged in regular weekly meetings.",
  "All meetings are on the same day and at the same time each week, have the same printed agenda, start on time, and end on time.",
  "All teams clearly identify, discuss, and solve key issues for the greater good and long term.",
  "Our systems and processes are documented, simplified, and followed by all.",
  "We have a system for receiving regular customer and employee feedback, and we know their level of satisfaction.",
  "A Scorecard for weekly metrics and measurables is in place.",
  "Everyone in the organization has a number.",
  "We have a budget and are monitoring it regularly (e.g., monthly or quarterly).",
];
