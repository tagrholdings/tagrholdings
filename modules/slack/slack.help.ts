/**
 * What the bot says when someone asks what it can do. Fixed text on purpose: a model improvising this list would one day
 * promise something the bot can't do. Keep it in step with the tools in slack.agent.ts / slack.records.ts / slack.eos.ts.
 */
export type HelpLanguage = "en" | "pt";

const EN = [
  "*Here's what I can do.* Just write (or send a voice note) in plain language, in any language. I show a card first — *Create* saves it, *Cancel* drops it.",
  "",
  "*Tasks & calls* — _\"remind me to call Padaria X tomorrow at 10\"_, _\"task for Carlos: send the LOI by Friday\"_, _\"mark the Padaria call as done\"_",
  "*Look things up* — _\"what's due today?\"_, _\"what do I have this week?\"_, _\"anything on the 28th?\"_, _\"overdue since Monday\"_",
  "*Leads & projects* — _\"new lead Bakery Z\"_, _\"move Lavanderia Central to closed\"_, _\"list my leads\"_",
  "*Contacts & companies* — _\"create a contact Ana Costa, ana@acme.com, at Padaria X\"_, _\"update Padaria X's website\"_",
  "*Notes* — _\"note on the Padaria lead: owner wants to sell in spring\"_ (added with the date, never replaces anything)",
  "*Pipeline* — _\"how's the pipeline? what's stuck?\"_ (stuck = untouched for 14+ days)",
  "*Traction (EOS)* — _\"add an issue: hiring is behind\"_, _\"to-do for Maria: book the venue\"_, _\"what are the open issues?\"_",
  "*Team* — _\"add Maria Silva to the team\"_",
  "",
  "*Reply in my thread* to correct something (\"make it Friday\", \"also assign it to Carlos\").",
  "*On any Slack message:* ⋯ More actions → *Create CRM task*.",
  "*My direct messages to you* (reminders, L10, daily summary, weekly summaries): _\"stop the reminders\"_, _\"send me the daily summary\"_.",
  "",
  "_I can't create or rename boards — that's done in the CRM._",
].join("\n");

const PT = [
  "*Isto é o que eu faço.* É só escrever (ou mandar um áudio) em linguagem normal, em qualquer idioma. Eu mostro um card antes — *Create* salva, *Cancel* descarta.",
  "",
  "*Tarefas e ligações* — _\"me lembra de ligar pra Padaria X amanhã às 10\"_, _\"tarefa pro Carlos: mandar a LOI até sexta\"_, _\"marca a ligação da Padaria como feita\"_",
  "*Consultas* — _\"o que vence hoje?\"_, _\"o que tenho essa semana?\"_, _\"tem algo dia 28?\"_, _\"atrasadas desde segunda\"_",
  "*Leads e projetos* — _\"novo lead Bakery Z\"_, _\"move Lavanderia Central pra closed\"_, _\"lista meus leads\"_",
  "*Contatos e empresas* — _\"cria o contato Ana Costa, ana@acme.com, na Padaria X\"_, _\"atualiza o site da Padaria X\"_",
  "*Notas* — _\"anota no lead da Padaria: dono quer vender na primavera\"_ (entra com a data, nunca substitui nada)",
  "*Pipeline* — _\"como está o pipeline? o que está parado?\"_ (parado = 14+ dias sem mexer)",
  "*Traction (EOS)* — _\"add issue: contratação atrasada\"_, _\"to-do pra Maria: reservar o local\"_, _\"quais issues abertas?\"_",
  "*Time* — _\"adiciona a Maria Silva no time\"_",
  "",
  "*Responda na minha thread* para corrigir algo (\"muda pra sexta\", \"atribui também ao Carlos\").",
  "*Em qualquer mensagem do Slack:* ⋯ Mais ações → *Create CRM task*.",
  "*Minhas DMs para você* (lembretes, L10, resumo diário, relatório semanal): _\"para os lembretes\"_, _\"manda o resumo diário\"_.",
  "",
  "_Não crio nem renomeio quadros — isso é feito no CRM._",
].join("\n");

export function helpText(language: HelpLanguage = "en"): string {
  return language === "pt" ? PT : EN;
}
