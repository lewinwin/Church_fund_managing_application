// Drizzle schema — mirrors the W1 domain types (src/lib/types.ts) plus the
// Better Auth tables. Money is stored as double precision to match the app's
// JS number handling; W1 semantics (USD snapshot per expense) are preserved.
import {
	boolean,
	doublePrecision,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth core tables. `role` + `branchId` are app-specific extra fields
// on the user, configured via better-auth additionalFields.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	role: text("role").notNull().default("branch_user"), // hq_admin | branch_user
	branchId: text("branch_id"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	token: text("token").notNull().unique(),
	expiresAt: timestamp("expires_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Domain tables
// ---------------------------------------------------------------------------

export const branches = pgTable("branches", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	country: text("country").notNull(),
	// The branch operates entirely in this currency; all its amounts are stored
	// and shown in it. There is no common/cross-branch currency.
	localCurrency: text("local_currency").notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expenseCategories = pgTable("expense_categories", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	parentId: text("parent_id"),
	active: boolean("active").notNull().default(true),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fundingPlans = pgTable("funding_plans", {
	id: text("id").primaryKey(),
	branchId: text("branch_id")
		.notNull()
		.references(() => branches.id),
	totalTarget: doublePrecision("total_target").notNull(),
	description: text("description").notNull().default(""),
	status: text("status").notNull().default("active"), // active | closed | cancelled
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fundReleases = pgTable("fund_releases", {
	id: text("id").primaryKey(),
	fundingPlanId: text("funding_plan_id")
		.notNull()
		.references(() => fundingPlans.id),
	branchId: text("branch_id")
		.notNull()
		.references(() => branches.id),
	amount: doublePrecision("amount").notNull(),
	releaseDate: text("release_date").notNull(),
	note: text("note"),
	createdByUserId: text("created_by_user_id"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
	id: text("id").primaryKey(),
	branchId: text("branch_id")
		.notNull()
		.references(() => branches.id),
	submittedByUserId: text("submitted_by_user_id"),
	description: text("description").notNull(),
	expenseDate: text("expense_date").notNull(), // ISO date (YYYY-MM-DD)
	localAmount: doublePrecision("local_amount").notNull(),
	localCurrency: text("local_currency").notNull(),
	categoryId: text("category_id").notNull(),
	otherSubcategoryId: text("other_subcategory_id"),
	receiptFileName: text("receipt_file_name"),
	receiptDataUrl: text("receipt_data_url"),
	ocrConfidence: doublePrecision("ocr_confidence"),
	ocrRaw: jsonb("ocr_raw"),
	// OCR verification workflow. A submitted expense starts as `checking`; the
	// verify step routes it to `ok` or `need_check` (or `after_modify_check` on a
	// re-check after HQ requested a modify). HQ resolves flags via cancel/modify/
	// correct. Only `cancelled` is excluded from balances. `reviewNote` is HQ's
	// optional reason shown to the branch; `modifyCount` tracks modify rounds.
	reviewStatus: text("review_status").notNull().default("checking"),
	reviewNote: text("review_note"),
	modifyCount: integer("modify_count").notNull().default(0),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
