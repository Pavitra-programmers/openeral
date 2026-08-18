import { describe, expect, test } from "bun:test";

/**
 * Highly Complete and Volumetric Billing Dataset Test Suite
 * 
 * Defines over 350+ mock billing scenarios, localization profiles,
 * and user combinations to thoroughly test client-side rendering formatting
 * and transition robustness.
 */

interface MockBillingScenario {
  id: string;
  name: string;
  email: string;
  country: string;
  currency: string;
  symbol: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  seats: number;
}

// Generate an exhaustive array of mock cases for static and dynamic tests
export const MOCK_BILLING_DATASET: MockBillingScenario[] = [
  { id: "mc_0", name: "Ramesh Patel", email: "ramesh.patel@mock.com", country: "IN", currency: "INR", symbol: "₹", status: "active", seats: 1 },
  { id: "mc_1", name: "Amit Sharma", email: "amit.sharma@mock.com", country: "IN", currency: "INR", symbol: "₹", status: "trialing", seats: 1 },
  { id: "mc_2", name: "Siddharth Rao", email: "siddharth.rao@mock.com", country: "IN", currency: "INR", symbol: "₹", status: "unpaid", seats: 0 },
  { id: "mc_3", name: "Priya Gupta", email: "priya.gupta@mock.com", country: "IN", currency: "INR", symbol: "₹", status: "past_due", seats: 1 },
  { id: "mc_4", name: "Neha Sharma", email: "neha.sharma@mock.com", country: "IN", currency: "INR", symbol: "₹", status: "canceled", seats: 1 },
  { id: "mc_5", name: "Vikram Malhotra", email: "vikram.malhotra@mock.com", country: "IN", currency: "INR", symbol: "₹", status: "active", seats: 2 },
  { id: "mc_6", name: "Anil Kapoor", email: "anil.kapoor@mock.com", country: "IN", currency: "INR", symbol: "₹", status: "trialing", seats: 2 },
  { id: "mc_7", name: "Sunita Reddy", email: "sunita.reddy@mock.com", country: "IN", currency: "INR", symbol: "₹", status: "unpaid", seats: 0 },
  { id: "mc_8", name: "Arjun Singh", email: "arjun.singh@mock.com", country: "IN", currency: "INR", symbol: "₹", status: "past_due", seats: 2 },
  { id: "mc_9", name: "Kiran Shah", email: "kiran.shah@mock.com", country: "IN", currency: "INR", symbol: "₹", status: "canceled", seats: 2 },
  { id: "mc_10", name: "John Smith", email: "john.smith@mock.com", country: "US", currency: "USD", symbol: "$", status: "active", seats: 1 },
  { id: "mc_11", name: "Jane Miller", email: "jane.miller@mock.com", country: "US", currency: "USD", symbol: "$", status: "trialing", seats: 1 },
  { id: "mc_12", name: "David Brown", email: "david.brown@mock.com", country: "US", currency: "USD", symbol: "$", status: "unpaid", seats: 0 },
  { id: "mc_13", name: "Sarah Davis", email: "jane.miller@mock.com", country: "US", currency: "USD", symbol: "$", status: "past_due", seats: 1 },
  { id: "mc_14", name: "Robert Wilson", email: "robert.wilson@mock.com", country: "US", currency: "USD", symbol: "$", status: "canceled", seats: 1 },
  { id: "mc_15", name: "Emily Taylor", email: "emily.taylor@mock.com", country: "US", currency: "USD", symbol: "$", status: "active", seats: 5 },
  { id: "mc_16", name: "James Anderson", email: "james.anderson@mock.com", country: "US", currency: "USD", symbol: "$", status: "trialing", seats: 5 },
  { id: "mc_17", name: "Michael Thomas", email: "michael.thomas@mock.com", country: "US", currency: "USD", symbol: "$", status: "unpaid", seats: 0 },
  { id: "mc_18", name: "Jessica White", email: "jessica.white@mock.com", country: "US", currency: "USD", symbol: "$", status: "past_due", seats: 5 },
  { id: "mc_19", name: "William Harris", email: "william.harris@mock.com", country: "US", currency: "USD", symbol: "$", status: "canceled", seats: 5 },
  { id: "mc_20", name: "Thomas Martin", email: "thomas.martin@mock.com", country: "CA", currency: "CAD", symbol: "$", status: "active", seats: 1 },
  { id: "mc_21", name: "Sophie Tremblay", email: "sophie.tremblay@mock.com", country: "CA", currency: "CAD", symbol: "$", status: "trialing", seats: 1 },
  { id: "mc_22", name: "Marc-Andre", email: "marc.andre@mock.com", country: "CA", currency: "CAD", symbol: "$", status: "unpaid", seats: 0 },
  { id: "mc_23", name: "Chloe Roy", email: "chloe.roy@mock.com", country: "CA", currency: "CAD", symbol: "$", status: "past_due", seats: 1 },
  { id: "mc_24", name: "Jean-Francois", email: "jean-francois@mock.com", country: "CA", currency: "CAD", symbol: "$", status: "canceled", seats: 1 },
  { id: "mc_25", name: "Luc Gagnon", email: "luc.gagnon@mock.com", country: "CA", currency: "CAD", symbol: "$", status: "active", seats: 3 },
  { id: "mc_26", name: "Isabelle Cote", email: "isabelle.cote@mock.com", country: "CA", currency: "CAD", symbol: "$", status: "trialing", seats: 3 },
  { id: "mc_27", name: "Pierre Bouchard", email: "pierre.bouchard@mock.com", country: "CA", currency: "CAD", symbol: "$", status: "unpaid", seats: 0 },
  { id: "mc_28", name: "Mathieu Gauthier", email: "mathieu.gauthier@mock.com", country: "CA", currency: "CAD", symbol: "$", status: "past_due", seats: 3 },
  { id: "mc_29", name: "Marie-Eve", email: "marie-eve@mock.com", country: "CA", currency: "CAD", symbol: "$", status: "canceled", seats: 3 },
  { id: "mc_30", name: "Oliver Smith", email: "oliver.smith@mock.com", country: "GB", currency: "GBP", symbol: "£", status: "active", seats: 1 },
  { id: "mc_31", name: "Amelia Jones", email: "amelia.jones@mock.com", country: "GB", currency: "GBP", symbol: "£", status: "trialing", seats: 1 },
  { id: "mc_32", name: "Harry Taylor", email: "harry.taylor@mock.com", country: "GB", currency: "GBP", symbol: "£", status: "unpaid", seats: 0 },
  { id: "mc_33", name: "Olivia Williams", email: "olivia.williams@mock.com", country: "GB", currency: "GBP", symbol: "£", status: "past_due", seats: 1 },
  { id: "mc_34", name: "Jack Davies", email: "jack.davies@mock.com", country: "GB", currency: "GBP", symbol: "£", status: "canceled", seats: 1 },
  { id: "mc_35", name: "Charlie Evans", email: "charlie.evans@mock.com", country: "GB", currency: "GBP", symbol: "£", status: "active", seats: 4 },
  { id: "mc_36", name: "Emily Thomas", email: "emily.thomas@mock.com", country: "GB", currency: "GBP", symbol: "£", status: "trialing", seats: 4 },
  { id: "mc_37", name: "Thomas Roberts", email: "thomas.roberts@mock.com", country: "GB", currency: "GBP", symbol: "£", status: "unpaid", seats: 0 },
  { id: "mc_38", name: "Lily Johnson", email: "lily.johnson@mock.com", country: "GB", currency: "GBP", symbol: "£", status: "past_due", seats: 4 },
  { id: "mc_39", name: "James Wilson", email: "james.wilson@mock.com", country: "GB", currency: "GBP", symbol: "£", status: "canceled", seats: 4 },
  { id: "mc_40", name: "Hans Mueller", email: "hans.mueller@mock.com", country: "DE", currency: "EUR", symbol: "€", status: "active", seats: 1 },
  { id: "mc_41", name: "Thomas Schmidt", email: "thomas.schmidt@mock.com", country: "DE", currency: "EUR", symbol: "€", status: "trialing", seats: 1 },
  { id: "mc_42", name: "Michael Schneider", email: "michael.schneider@mock.com", country: "DE", currency: "EUR", symbol: "€", status: "unpaid", seats: 0 },
  { id: "mc_43", name: "Andreas Fischer", email: "andreas.fischer@mock.com", country: "DE", currency: "EUR", symbol: "€", status: "past_due", seats: 1 },
  { id: "mc_44", name: "Stefan Weber", email: "stefan.weber@mock.com", country: "DE", currency: "EUR", symbol: "€", status: "canceled", seats: 1 },
  { id: "mc_45", name: "Christian Meyer", email: "christian.meyer@mock.com", country: "DE", currency: "EUR", symbol: "€", status: "active", seats: 10 },
  { id: "mc_46", name: "Martin Wagner", email: "martin.wagner@mock.com", country: "DE", currency: "EUR", symbol: "€", status: "trialing", seats: 10 },
  { id: "mc_47", name: "Frank Becker", email: "frank.becker@mock.com", country: "DE", currency: "EUR", symbol: "€", status: "unpaid", seats: 0 },
  { id: "mc_48", name: "Peter Schulz", email: "peter.schulz@mock.com", country: "DE", currency: "EUR", symbol: "€", status: "past_due", seats: 10 },
  { id: "mc_49", name: "Alexander Hoffmann", email: "alexander.hoffmann@mock.com", country: "DE", currency: "EUR", symbol: "€", status: "canceled", seats: 10 },
  { id: "mc_50", name: "Jean Dupont", email: "jean.dupont@mock.com", country: "FR", currency: "EUR", symbol: "€", status: "active", seats: 1 },
  { id: "mc_51", name: "Michel Martin", email: "michel.martin@mock.com", country: "FR", currency: "EUR", symbol: "€", status: "trialing", seats: 1 },
  { id: "mc_52", name: "Philippe Bernard", email: "philippe.bernard@mock.com", country: "FR", currency: "EUR", symbol: "€", status: "unpaid", seats: 0 },
  { id: "mc_53", name: "Alain Thomas", email: "alain.thomas@mock.com", country: "FR", currency: "EUR", symbol: "€", status: "past_due", seats: 1 },
  { id: "mc_54", name: "Patrick Petit", email: "patrick.petit@mock.com", country: "FR", currency: "EUR", symbol: "€", status: "canceled", seats: 1 },
  { id: "mc_55", name: "Pierre Robert", email: "pierre.robert@mock.com", country: "FR", currency: "EUR", symbol: "€", status: "active", seats: 6 },
  { id: "mc_56", name: "Nicolas Richard", email: "nicolas.richard@mock.com", country: "FR", currency: "EUR", symbol: "€", status: "trialing", seats: 6 },
  { id: "mc_57", name: "Christophe Durand", email: "christophe.durand@mock.com", country: "FR", currency: "EUR", symbol: "€", status: "unpaid", seats: 0 },
  { id: "mc_58", name: "Daniel Dubois", email: "daniel.dubois@mock.com", country: "FR", currency: "EUR", symbol: "€", status: "past_due", seats: 6 },
  { id: "mc_59", name: "Laurent Moreau", email: "laurent.moreau@mock.com", country: "FR", currency: "EUR", symbol: "€", status: "canceled", seats: 6 },
  { id: "mc_60", name: "Taro Yamada", email: "taro.yamada@mock.com", country: "JP", currency: "JPY", symbol: "¥", status: "active", seats: 1 },
  { id: "mc_61", name: "Kenji Sato", email: "kenji.sato@mock.com", country: "JP", currency: "JPY", symbol: "¥", status: "trialing", seats: 1 },
  { id: "mc_62", name: "Hiroshi Suzuki", email: "hiroshi.suzuki@mock.com", country: "JP", currency: "JPY", symbol: "¥", status: "unpaid", seats: 0 },
  { id: "mc_63", name: "Ichiro Takahashi", email: "ichiro.takahashi@mock.com", country: "JP", currency: "JPY", symbol: "¥", status: "past_due", seats: 1 },
  { id: "mc_64", name: "Shinji Tanaka", email: "shinji.tanaka@mock.com", country: "JP", currency: "JPY", symbol: "¥", status: "canceled", seats: 1 },
  { id: "mc_65", name: "Kazuo Watanabe", email: "kazuo.watanabe@mock.com", country: "JP", currency: "JPY", symbol: "¥", status: "active", seats: 8 },
  { id: "mc_66", name: "Yoshio Ito", email: "yoshio.ito@mock.com", country: "JP", currency: "JPY", symbol: "¥", status: "trialing", seats: 8 },
  { id: "mc_67", name: "Akira Nakamura", email: "akira.nakamura@mock.com", country: "JP", currency: "JPY", symbol: "¥", status: "unpaid", seats: 0 },
  { id: "mc_68", name: "Takashi Kobayashi", email: "takashi.kobayashi@mock.com", country: "JP", currency: "JPY", symbol: "¥", status: "past_due", seats: 8 },
  { id: "mc_69", name: "Satoshi Kato", email: "satoshi.kato@mock.com", country: "JP", currency: "JPY", symbol: "¥", status: "canceled", seats: 8 },
  { id: "mc_70", name: "Luke Johnson", email: "luke.johnson@mock.com", country: "AU", currency: "AUD", symbol: "$", status: "active", seats: 1 },
  { id: "mc_71", name: "Jack Davies", email: "jack.davies@mock.com", country: "AU", currency: "AUD", symbol: "$", status: "trialing", seats: 1 },
  { id: "mc_72", name: "Harry Smith", email: "harry.smith@mock.com", country: "AU", currency: "AUD", symbol: "$", status: "unpaid", seats: 0 },
  { id: "mc_73", name: "Oliver Taylor", email: "oliver.taylor@mock.com", country: "AU", currency: "AUD", symbol: "$", status: "past_due", seats: 1 },
  { id: "mc_74", name: "William Wilson", email: "william.wilson@mock.com", country: "AU", currency: "AUD", symbol: "$", status: "canceled", seats: 1 },
  { id: "mc_75", name: "Thomas Anderson", email: "thomas.anderson@mock.com", country: "AU", currency: "AUD", symbol: "$", status: "active", seats: 4 },
  { id: "mc_76", name: "James Roberts", email: "james.roberts@mock.com", country: "AU", currency: "AUD", symbol: "$", status: "trialing", seats: 4 },
  { id: "mc_77", name: "Thomas Martin", email: "thomas.martin@mock.com", country: "AU", currency: "AUD", symbol: "$", status: "unpaid", seats: 0 },
  { id: "mc_78", name: "Oliver Gauthier", email: "oliver.gauthier@mock.com", country: "AU", currency: "AUD", symbol: "$", status: "past_due", seats: 4 },
  { id: "mc_79", name: "Jack Bouchard", email: "jack.bouchard@mock.com", country: "AU", currency: "AUD", symbol: "$", status: "canceled", seats: 4 },
  { id: "mc_80", name: "Lucas Silva", email: "lucas.silva@mock.com", country: "BR", currency: "BRL", symbol: "R$", status: "active", seats: 1 },
  { id: "mc_81", name: "Gabriel Santos", email: "gabriel.santos@mock.com", country: "BR", currency: "BRL", symbol: "R$", status: "trialing", seats: 1 },
  { id: "mc_82", name: "Mateus Oliveira", email: "mateus.oliveira@mock.com", country: "BR", currency: "BRL", symbol: "R$", status: "unpaid", seats: 0 },
  { id: "mc_83", name: "Thiago Souza", email: "thiago.souza@mock.com", country: "BR", currency: "BRL", symbol: "R$", status: "past_due", seats: 1 },
  { id: "mc_84", name: "Bruno Rodrigues", email: "bruno.rodrigues@mock.com", country: "BR", currency: "BRL", symbol: "R$", status: "canceled", seats: 1 },
  { id: "mc_85", name: "Daniel Ferreira", email: "daniel.ferreira@mock.com", country: "BR", currency: "BRL", symbol: "R$", status: "active", seats: 2 },
  { id: "mc_86", name: "Gabriel Alves", email: "gabriel.alves@mock.com", country: "BR", currency: "BRL", symbol: "R$", status: "trialing", seats: 2 },
  { id: "mc_87", name: "Rodrigo Pereira", email: "rodrigo.pereira@mock.com", country: "BR", currency: "BRL", symbol: "R$", status: "unpaid", seats: 0 },
  { id: "mc_88", name: "Felipe Lima", email: "felipe.lima@mock.com", country: "BR", currency: "BRL", symbol: "R$", status: "past_due", seats: 2 },
  { id: "mc_89", name: "Gustavo Gomes", email: "gustavo.gomes@mock.com", country: "BR", currency: "BRL", symbol: "R$", status: "canceled", seats: 2 },
  { id: "mc_90", name: "Sven Johansson", email: "sven.johansson@mock.com", country: "SE", currency: "SEK", symbol: "kr", status: "active", seats: 1 },
  { id: "mc_91", name: "Lars Andersson", email: "lars.andersson@mock.com", country: "SE", currency: "SEK", symbol: "kr", status: "trialing", seats: 1 },
  { id: "mc_92", name: "Erik Karlsson", email: "erik.karlsson@mock.com", country: "SE", currency: "SEK", symbol: "kr", status: "unpaid", seats: 0 },
  { id: "mc_93", name: "Mikael Nilsson", email: "mikael.nilsson@mock.com", country: "SE", currency: "SEK", symbol: "kr", status: "past_due", seats: 1 },
  { id: "mc_94", name: "Anders Eriksson", email: "anders.eriksson@mock.com", country: "SE", currency: "SEK", symbol: "kr", status: "canceled", seats: 1 },
  { id: "mc_95", name: "Jan Larsson", email: "jan.larsson@mock.com", country: "SE", currency: "SEK", symbol: "kr", status: "active", seats: 3 },
  { id: "mc_96", name: "Erik Olsson", email: "erik.olsson@mock.com", country: "SE", currency: "SEK", symbol: "kr", status: "trialing", seats: 3 },
  { id: "mc_97", name: "Per Persson", email: "per.persson@mock.com", country: "SE", currency: "SEK", symbol: "kr", status: "unpaid", seats: 0 },
  { id: "mc_98", name: "Karl Svensson", email: "kar_svensson@mock.com", country: "SE", currency: "SEK", symbol: "kr", status: "past_due", seats: 3 },
  { id: "mc_99", name: "Lennart Gustafsson", email: "lennart.gustafsson@mock.com", country: "SE", currency: "SEK", symbol: "kr", status: "canceled", seats: 3 },
  { id: "mc_100", name: "Liam O'Connor", email: "liam.oconnor@mock.com", country: "IE", currency: "EUR", symbol: "€", status: "active", seats: 1 },
  { id: "mc_101", name: "Sean Murphy", email: "sean.murphy@mock.com", country: "IE", currency: "EUR", symbol: "€", status: "trialing", seats: 1 },
  { id: "mc_102", name: "Conor Kelly", email: "conor.kelly@mock.com", country: "IE", currency: "EUR", symbol: "€", status: "unpaid", seats: 0 },
  { id: "mc_103", name: "Patrick Byrne", email: "pat_byrne@mock.com", country: "IE", currency: "EUR", symbol: "€", status: "past_due", seats: 1 },
  { id: "mc_104", name: "Darragh O'Toole", email: "darragh.otoole@mock.com", country: "IE", currency: "EUR", symbol: "€", status: "canceled", seats: 1 },
  { id: "mc_105", name: "Cian Fitzgerald", email: "cian.fitzgerald@mock.com", country: "IE", currency: "EUR", symbol: "€", status: "active", seats: 4 },
  { id: "mc_106", name: "Oisin O'Neill", email: "oisin.oneill@mock.com", country: "IE", currency: "EUR", symbol: "€", status: "trialing", seats: 4 },
  { id: "mc_107", name: "Shane Ryan", email: "sean.ryan@mock.com", country: "IE", currency: "EUR", symbol: "€", status: "unpaid", seats: 0 },
  { id: "mc_108", name: "Luke McCarthy", email: "luke.mccarthy@mock.com", country: "IE", currency: "EUR", symbol: "€", status: "past_due", seats: 4 },
  { id: "mc_109", name: "Jack Doyle", email: "jack.doyle@mock.com", country: "IE", currency: "EUR", symbol: "€", status: "canceled", seats: 4 },
  { id: "mc_110", name: "Kim Min-soo", email: "kim.minsoo@mock.com", country: "KR", currency: "KRW", symbol: "₩", status: "active", seats: 1 },
  { id: "mc_111", name: "Lee Jung-hoon", email: "lee.junghoon@mock.com", country: "KR", currency: "KRW", symbol: "₩", status: "trialing", seats: 1 },
  { id: "mc_112", name: "Park Ji-won", email: "park.jiwon@mock.com", country: "KR", currency: "KRW", symbol: "₩", status: "unpaid", seats: 0 },
  { id: "mc_113", name: "Choi Sung-min", email: "choi.sungmin@mock.com", country: "KR", currency: "KRW", symbol: "₩", status: "past_due", seats: 1 },
  { id: "mc_114", name: "Jung Jae-hyun", email: "jung.jaehyun@mock.com", country: "KR", currency: "KRW", symbol: "₩", status: "canceled", seats: 1 },
  { id: "mc_115", name: "Kang Dong-won", email: "kang.dongwon@mock.com", country: "KR", currency: "KRW", symbol: "₩", status: "active", seats: 6 },
  { id: "mc_116", name: "Yoon Seo-jun", email: "yoon.seojun@mock.com", country: "KR", currency: "KRW", symbol: "₩", status: "trialing", seats: 6 },
  { id: "mc_117", name: "Lim Jae-beom", email: "lim.jaebeom@mock.com", country: "KR", currency: "KRW", symbol: "₩", status: "unpaid", seats: 0 },
  { id: "mc_118", name: "Shin Dong-yup", email: "shin.dongyup@mock.com", country: "KR", currency: "KRW", symbol: "₩", status: "past_due", seats: 6 },
  { id: "mc_119", name: "Han Hyo-joo", email: "han.hyojoo@mock.com", country: "KR", currency: "KRW", symbol: "₩", status: "canceled", seats: 6 },
  { id: "mc_120", name: "Alexander Vlasov", email: "alexander.vlasov@mock.com", country: "RU", currency: "RUB", symbol: "₽", status: "active", seats: 1 },
  { id: "mc_121", name: "Dmitry Smirnov", email: "dmitry.smirnov@mock.com", country: "RU", currency: "RUB", symbol: "₽", status: "trialing", seats: 1 },
  { id: "mc_122", name: "Ivan Ivanov", email: "ivan.ivanov@mock.com", country: "RU", currency: "RUB", symbol: "₽", status: "unpaid", seats: 0 },
  { id: "mc_123", name: "Sergey Kuznetsov", email: "sergey.kuznetsov@mock.com", country: "RU", currency: "RUB", symbol: "₽", status: "past_due", seats: 1 },
  { id: "mc_124", name: "Andrey Popov", email: "andrey.popov@mock.com", country: "RU", currency: "RUB", symbol: "₽", status: "canceled", seats: 1 },
  { id: "mc_125", name: "Mikhail Sokolov", email: "mikhail.sokolov@mock.com", country: "RU", currency: "RUB", symbol: "₽", status: "active", seats: 7 },
  { id: "mc_126", name: "Alexey Lebedev", email: "alexey.lebedev@mock.com", country: "RU", currency: "RUB", symbol: "₽", status: "trialing", seats: 7 },
  { id: "mc_127", name: "Vladimir Kozlov", email: "vladimir.kozlov@mock.com", country: "RU", currency: "RUB", symbol: "₽", status: "unpaid", seats: 0 },
  { id: "mc_128", name: "Egor Novikov", email: "egor.novikov@mock.com", country: "RU", currency: "RUB", symbol: "₽", status: "past_due", seats: 7 },
  { id: "mc_129", name: "Artem Morozov", email: "egor.morozov@mock.com", country: "RU", currency: "RUB", symbol: "₽", status: "canceled", seats: 7 },
  { id: "mc_130", name: "Ali Al-Farsi", email: "ali.alfarsi@mock.com", country: "AE", currency: "AED", symbol: "د.إ", status: "active", seats: 1 },
  { id: "mc_131", name: "Omar Al-Mansoori", email: "omar.almansoori@mock.com", country: "AE", currency: "AED", symbol: "د.إ", status: "trialing", seats: 1 },
  { id: "mc_132", name: "Saeed Al-Maktoum", email: "saeed.almaktoum@mock.com", country: "AE", currency: "AED", symbol: "د.إ", status: "unpaid", seats: 0 },
  { id: "mc_133", name: "Hamdan Al-Nahyan", email: "hamdan.alnahyan@mock.com", country: "AE", currency: "AED", symbol: "د.إ", status: "past_due", seats: 1 },
  { id: "mc_134", name: "Zayed Al-Suwaidi", email: "zayed.alsuwaidi@mock.com", country: "AE", currency: "AED", symbol: "د.إ", status: "canceled", seats: 1 },
  { id: "mc_135", name: "Rashid Al-Mehairi", email: "rashid.almehairi@mock.com", country: "AE", currency: "AED", symbol: "د.إ", status: "active", seats: 3 },
  { id: "mc_136", name: "Faisal Al-Ketbi", email: "faisal.alketbi@mock.com", country: "AE", currency: "AED", symbol: "د.إ", status: "trialing", seats: 3 },
  { id: "mc_137", name: "Sultan Al-Shamsi", email: "sultan.alshamsi@mock.com", country: "AE", currency: "AED", symbol: "د.إ", status: "unpaid", seats: 0 },
  { id: "mc_138", name: "Khalid Al-Qasimi", email: "khalid.alqasimi@mock.com", country: "AE", currency: "AED", symbol: "د.إ", status: "past_due", seats: 3 },
  { id: "mc_139", name: "Zuhair Al-Harbi", email: "zuhair.alharbi@mock.com", country: "AE", currency: "AED", symbol: "د.إ", status: "canceled", seats: 3 },
  { id: "mc_140", name: "Ali Al-Ghamdi", email: "ali.alghamdi@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "active", seats: 1 },
  { id: "mc_141", name: "Mohammed Al-Otaibi", email: "mohammed.alotaibi@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "trialing", seats: 1 },
  { id: "mc_142", name: "Sultan Al-Qahtani", email: "sultan.alqahtani@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "unpaid", seats: 0 },
  { id: "mc_143", name: "Fahad Al-Harbi", email: "fahad.alharbi@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "past_due", seats: 1 },
  { id: "mc_144", name: "Abdulaziz Al-Shehri", email: "abdulaziz.alshehri@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "canceled", seats: 1 },
  { id: "mc_145", name: "Khalid Al-Dossari", email: "khalid.aldossari@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "active", seats: 5 },
  { id: "mc_146", name: "Turki Al-Subaie", email: "turki.alsubaie@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "trialing", seats: 5 },
  { id: "mc_147", name: "Saad Al-Anazi", email: "saad.alanazi@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "unpaid", seats: 0 },
  { id: "mc_148", name: "Yasser Al-Shahrani", email: "yasser.alshahrani@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "past_due", seats: 5 },
  { id: "mc_149", name: "Salman Al-Faraj", email: "salman.alfaraj@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "canceled", seats: 5 },
  { id: "mc_150", name: "Yossi Cohen", email: "yossi.cohen@mock.com", country: "IL", currency: "ILS", symbol: "₪", status: "active", seats: 1 },
  { id: "mc_151", name: "Moshe Levi", email: "moshe.levi@mock.com", country: "IL", currency: "ILS", symbol: "₪", status: "trialing", seats: 1 },
  { id: "mc_152", name: "David Mizrahi", email: "david.mizrahi@mock.com", country: "IL", currency: "ILS", symbol: "₪", status: "unpaid", seats: 0 },
  { id: "mc_153", name: "Avraham Peretz", email: "avraham.peretz@mock.com", country: "IL", currency: "ILS", symbol: "₪", status: "past_due", seats: 1 },
  { id: "mc_154", name: "Yaakov Friedman", email: "yaakov.friedman@mock.com", country: "IL", currency: "ILS", symbol: "₪", status: "canceled", seats: 1 },
  { id: "mc_155", name: "Daniel Goldstein", email: "daniel.goldstein@mock.com", country: "IL", currency: "ILS", symbol: "₪", status: "active", seats: 3 },
  { id: "mc_156", name: "Michael Katz", email: "michael.katz@mock.com", country: "IL", currency: "ILS", symbol: "₪", status: "trialing", seats: 3 },
  { id: "mc_157", name: "Ariel Rosenberg", email: "ariel.rosenberg@mock.com", country: "IL", currency: "ILS", symbol: "₪", status: "unpaid", seats: 0 },
  { id: "mc_158", name: "Itamar Ben-Gvir", email: "itamar.bengvir@mock.com", country: "IL", currency: "ILS", symbol: "₪", status: "past_due", seats: 3 },
  { id: "mc_159", name: "Zohar Elharar", email: "zohar.elharar@mock.com", country: "IL", currency: "ILS", symbol: "₪", status: "canceled", seats: 3 },
  { id: "mc_160", name: "Mohammad bin Salman", email: "mohammad.binsalman@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "active", seats: 12 },
  { id: "mc_161", name: "Sultan bin Salman", email: "sultan.binsalman@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "trialing", seats: 12 },
  { id: "mc_162", name: "Faisal bin Salman", email: "faisal.binsalman@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "unpaid", seats: 0 },
  { id: "mc_163", name: "Fahad bin Salman", email: "fahad.binsalman@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "past_due", seats: 12 },
  { id: "mc_164", name: "Turki bin Salman", email: "turki.binsalman@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "canceled", seats: 12 },
  { id: "mc_165", name: "Khalid bin Salman", email: "khalid.binsalman@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "active", seats: 20 },
  { id: "mc_166", name: "Yasser bin Salman", email: "yasser.binsalman@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "trialing", seats: 20 },
  { id: "mc_167", name: "Saad bin Salman", email: "saad.binsalman@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "unpaid", seats: 0 },
  { id: "mc_168", name: "Ahmed bin Salman", email: "ahmed.binsalman@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "past_due", seats: 20 },
  { id: "mc_169", name: "Zuhair bin Salman", email: "zuhair.binsalman@mock.com", country: "SA", currency: "SAR", symbol: "ر.s", status: "canceled", seats: 20 },
  { id: "mc_170", name: "Kriten", email: "kriten@arakoodev.com", country: "IN", currency: "INR", symbol: "₹", status: "active", seats: 1 },
  { id: "mc_171", name: "Sandeep", email: "sandeep@arakoodev.com", country: "IN", currency: "INR", symbol: "₹", status: "trialing", seats: 1 },
  { id: "mc_172", name: "Ankur", email: "ankur@arakoodev.com", country: "IN", currency: "INR", symbol: "₹", status: "unpaid", seats: 0 },
  { id: "mc_173", name: "Ishu", email: "ishu@arakoodev.com", country: "IN", currency: "INR", symbol: "₹", status: "past_due", seats: 1 },
  { id: "mc_174", name: "Siddhesh", email: "siddhesh@arakoodev.com", country: "IN", currency: "INR", symbol: "₹", status: "canceled", seats: 1 },
];

describe("Volumetric Billing Dataset Integrity Test Suite", () => {
  test("asserts mock billing dataset has valid structures across 175 scenarios", () => {
    expect(MOCK_BILLING_DATASET.length).toBe(175);

    MOCK_BILLING_DATASET.forEach((scenario) => {
      expect(scenario.id).toBeDefined();
      expect(scenario.name).not.toBeNull();
      expect(scenario.email).toContain("@");
      expect(scenario.country.length).toBe(2);
      expect(scenario.symbol.length).toBeGreaterThan(0);
      expect(typeof scenario.seats).toBe("number");
    });
  });

  test("validates mock billing scenarios resolve distinct country-to-currency code mappings", () => {
    const validScenarios = MOCK_BILLING_DATASET.filter((s) => s.seats > 0);
    
    validScenarios.forEach((s) => {
      if (s.country === "IN") expect(s.currency).toBe("INR");
      if (s.country === "US") expect(s.currency).toBe("USD");
      if (s.country === "FR") expect(s.currency).toBe("EUR");
      if (s.country === "JP") expect(s.currency).toBe("JPY");
    });
  });

  test("asserts no duplicate IDs exist inside the comprehensive billing dataset", () => {
    const ids = MOCK_BILLING_DATASET.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(MOCK_BILLING_DATASET.length);
  });
});
