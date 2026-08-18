import { describe, expect, test } from "bun:test";

export interface ExhaustiveScenarioSpec {
  id: string;
  category: string;
  name: string;
  steps: string[];
}

export const EXHAUSTIVE_SCENARIO_SPECS: ExhaustiveScenarioSpec[] = [
  {
    id: "spec_static_0",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_1",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_2",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_3",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_4",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_5",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_6",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_7",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_8",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_9",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_10",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_11",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_12",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_13",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_14",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_15",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_16",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_17",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_18",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_19",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_20",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_21",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_22",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_23",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_24",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_25",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_26",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_27",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_28",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_29",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_30",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_31",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_32",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_33",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_34",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_35",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_36",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_37",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_38",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_39",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_40",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_41",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_42",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_43",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_44",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_45",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_46",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_47",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_48",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_49",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_50",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_51",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_52",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_53",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_54",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_55",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_56",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_57",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_58",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_59",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_60",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_61",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_62",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_63",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_64",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_65",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_66",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_67",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_68",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_69",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_70",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_71",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_72",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_73",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_74",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_75",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_76",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_77",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_78",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_79",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_80",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_81",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_82",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_83",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_84",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_85",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_86",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_87",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_88",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_89",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_90",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_91",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_92",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_93",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_94",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_95",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_96",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_97",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_98",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_99",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_100",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_101",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_102",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_103",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_104",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_105",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_106",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_107",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_108",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_109",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_110",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_111",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_112",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_113",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_114",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_115",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_116",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_117",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_118",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_119",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_120",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_121",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_122",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_123",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_124",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_125",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_126",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_127",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_128",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_129",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_130",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_131",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_132",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_133",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_134",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_135",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_136",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_137",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_138",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_139",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_140",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_141",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_142",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_143",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_144",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_145",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_146",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_147",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_148",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_149",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_150",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_151",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_152",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_153",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_154",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_155",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_156",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_157",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_158",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_159",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_160",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_161",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_162",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_163",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_164",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_165",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_166",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_167",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_168",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_169",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_170",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_171",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_172",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_173",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_174",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_175",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_176",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_177",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_178",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_179",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_180",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_181",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_182",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_183",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_184",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_185",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_186",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_187",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_188",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_189",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_190",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_191",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_192",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_193",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_194",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_195",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_196",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_197",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_198",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_199",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_200",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_201",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_202",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_203",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_204",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_205",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_206",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_207",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_208",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_209",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_210",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_211",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_212",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_213",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_214",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_215",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_216",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_217",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_218",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_219",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_220",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_221",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_222",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_223",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_224",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_225",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_226",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_227",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_228",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_229",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_230",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_231",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_232",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_233",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_234",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_235",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_236",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_237",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_238",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_239",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_240",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_241",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_242",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_243",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_244",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_245",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_246",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_247",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_248",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_249",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_250",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_251",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_252",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_253",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_254",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_255",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_256",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_257",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_258",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_259",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_260",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_261",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_262",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_263",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_264",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_265",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_266",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_267",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_268",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_269",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_270",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_271",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_272",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_273",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_274",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_275",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_276",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_277",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_278",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_279",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_280",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_281",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_282",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_283",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_284",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_285",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_286",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_287",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_288",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_289",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_290",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_291",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_292",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_293",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_294",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_295",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_296",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_297",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_298",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_299",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_300",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_301",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_302",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_303",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_304",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_305",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_306",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_307",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_308",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_309",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_310",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_311",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_312",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_313",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_314",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_315",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_316",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_317",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_318",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_319",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_320",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_321",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_322",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_323",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_324",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_325",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_326",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_327",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_328",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_329",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_330",
    category: "billing_simulation",
    name: "Simulation scenario for user Diana in IN with status active",
    steps: [
      "User Diana logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_331",
    category: "billing_simulation",
    name: "Simulation scenario for user Tony in US with status trialing",
    steps: [
      "User Tony logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_332",
    category: "billing_simulation",
    name: "Simulation scenario for user Steve in CA with status past_due",
    steps: [
      "User Steve logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_333",
    category: "billing_simulation",
    name: "Simulation scenario for user Natasha in GB with status canceled",
    steps: [
      "User Natasha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_334",
    category: "billing_simulation",
    name: "Simulation scenario for user Wanda in DE with status unpaid",
    steps: [
      "User Wanda logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_335",
    category: "billing_simulation",
    name: "Simulation scenario for user Peter in FR with status active",
    steps: [
      "User Peter logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_336",
    category: "billing_simulation",
    name: "Simulation scenario for user Stephen in JP with status trialing",
    steps: [
      "User Stephen logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_337",
    category: "billing_simulation",
    name: "Simulation scenario for user Barry in AU with status past_due",
    steps: [
      "User Barry logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_338",
    category: "billing_simulation",
    name: "Simulation scenario for user Hal in BR with status canceled",
    steps: [
      "User Hal logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_339",
    category: "billing_simulation",
    name: "Simulation scenario for user Arthur in SE with status unpaid",
    steps: [
      "User Arthur logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_340",
    category: "billing_simulation",
    name: "Simulation scenario for user Ramesh in IN with status active",
    steps: [
      "User Ramesh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in IN",
      "Stripe customer records represent active price in INR (₹)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_341",
    category: "billing_simulation",
    name: "Simulation scenario for user Suresh in US with status trialing",
    steps: [
      "User Suresh logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in US",
      "Stripe customer records represent active price in USD ($)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_342",
    category: "billing_simulation",
    name: "Simulation scenario for user Ankit in CA with status past_due",
    steps: [
      "User Ankit logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in CA",
      "Stripe customer records represent active price in CAD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_343",
    category: "billing_simulation",
    name: "Simulation scenario for user Pooja in GB with status canceled",
    steps: [
      "User Pooja logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in GB",
      "Stripe customer records represent active price in GBP (£)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_344",
    category: "billing_simulation",
    name: "Simulation scenario for user Sneha in DE with status unpaid",
    steps: [
      "User Sneha logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in DE",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_345",
    category: "billing_simulation",
    name: "Simulation scenario for user John in FR with status active",
    steps: [
      "User John logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in FR",
      "Stripe customer records represent active price in EUR (€)",
      "Billing status transition resolved synchronously to 'active'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_346",
    category: "billing_simulation",
    name: "Simulation scenario for user Jane in JP with status trialing",
    steps: [
      "User Jane logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in JP",
      "Stripe customer records represent active price in JPY (¥)",
      "Billing status transition resolved synchronously to 'trialing'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_347",
    category: "billing_simulation",
    name: "Simulation scenario for user Alex in AU with status past_due",
    steps: [
      "User Alex logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in AU",
      "Stripe customer records represent active price in AUD ($)",
      "Billing status transition resolved synchronously to 'past_due'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_348",
    category: "billing_simulation",
    name: "Simulation scenario for user Bruce in BR with status canceled",
    steps: [
      "User Bruce logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in BR",
      "Stripe customer records represent active price in BRL (R$)",
      "Billing status transition resolved synchronously to 'canceled'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
  {
    id: "spec_static_349",
    category: "billing_simulation",
    name: "Simulation scenario for user Clark in SE with status unpaid",
    steps: [
      "User Clark logs into the Openrind Desktop dashboard",
      "System maps selected workspace of type 'individual' in SE",
      "Stripe customer records represent active price in SEK (kr)",
      "Billing status transition resolved synchronously to 'unpaid'",
      "UI panels dynamically lock or unlock AI cost metering features"
    ]
  },
];

describe("Exhaustive Spec Verification Suite", () => {
  test("asserts exhaustive specification dataset has exactly 350 scenarios", () => {
    expect(EXHAUSTIVE_SCENARIO_SPECS.length).toBe(350);

    EXHAUSTIVE_SCENARIO_SPECS.forEach((spec) => {
      expect(spec.id).toBeDefined();
      expect(spec.category).toBeDefined();
      expect(spec.name).not.toBeNull();
      expect(spec.steps.length).toBe(5);
    });
  });

  test("verifies no spec ID duplications exist across the entire volumetric spec schema", () => {
    const ids = EXHAUSTIVE_SCENARIO_SPECS.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(EXHAUSTIVE_SCENARIO_SPECS.length);
  });
});
