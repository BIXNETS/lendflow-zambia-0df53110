# LendFlow Zambia

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_GITHUB_USERNAME%2FYOUR_REPO_NAME&env=VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY,VITE_SUPABASE_PROJECT_ID,SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,SUPABASE_SERVICE_ROLE_KEY,MOMO_WEBHOOK_SECRET&project-name=lendflow-zambia)

> Replace `YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` in the link above with your actual GitHub repository after syncing from Lovable. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide.

# Build LendFlow Zambia – Mobile Money Loan Platform

Create a modern, mobile-first fintech web application called "LendFlow Zambia".

The platform allows users in Zambia to register, verify their identity, activate their account, become eligible for loans, apply for loans, receive loan decisions, receive funds through mobile money, and repay loans.

The design should feel trustworthy, premium, secure, and professional, similar to leading African fintech products. The application must be designed from day one to support expansion into Ghana and other African markets.

---

# Core Product Vision

LendFlow Zambia provides fast access to digital loans through a simple onboarding experience. Users create an account, complete identity verification, activate their membership, and gain access to loan products based on configurable eligibility rules.

The platform must prioritize:

* Security

* Compliance readiness

* Scalability

* Mobile-first experience

* Automation

* Configurable business rules

The architecture should be designed to support tens of thousands of users without requiring major redesigns.

---

# Branding

Company Name:

LendFlow Zambia

Tagline:

Fast. Secure. Accessible Credit.

Primary Colors:

* Deep Blue

* Emerald Green

* White

Design Style:

* Modern fintech

* Premium appearance

* Clean dashboards

* Large touch-friendly controls

* Professional financial institution aesthetics

* High trust design language

* Investor-ready presentation quality

---

# User Roles

## Borrower

Can:

* Register account

* Login securely

* Complete profile

* Upload National ID

* Upload Selfie

* Complete KYC verification

* Activate account

* View eligibility

* Apply for loans

* Track applications

* View repayment schedules

* Make repayments

* Download loan agreements

* Receive notifications

* View transaction history

## Administrator

Can:

* Manage users

* Review KYC submissions

* Approve or reject KYC

* Review loan applications

* Approve or reject loans

* Configure loan products

* Configure loan eligibility rules

* Configure activation tiers

* Configure fees

* View reports

* Monitor repayments

* Manage notifications

* Export business reports

---

# Landing Page

Create a premium landing page.

Hero Section:

Headline:

Get Access To Fast Mobile Money Loans

Subheadline:

Register, verify your identity, activate your account, and access affordable digital loans directly to your mobile money wallet.

Primary CTA:

Apply Now

Secondary CTA:

Learn More

Sections:

## How It Works

1. Create Account

2. Verify Identity

3. Activate Membership

4. Apply For Loan

5. Receive Funds

## Benefits

* Fast Approval

* Secure Platform

* Mobile Money Payments

* Transparent Pricing

* Flexible Repayment

* Trusted Financial Technology

## Testimonials

Create realistic testimonial cards.

## FAQ Section

Generate comprehensive FAQs.

## Contact Section

Include:

* Contact Form

* Phone

* Email

* Office Location Placeholder

---

# Authentication

Create:

* Sign Up

* Login

* Logout

* Forgot Password

* Reset Password

* OTP Verification

Registration Fields:

* First Name

* Last Name

* Phone Number

* Email Address

* National ID Number

* Date Of Birth

* Gender

* Province

* City

* Residential Address

---

# KYC Verification

Users upload:

* National ID Front

* National ID Back

* Selfie Photo

Statuses:

* Pending

* Approved

* Rejected

Users cannot apply for loans until KYC is approved.

---

# Membership Activation

Users activate their account before loan eligibility becomes available.

Statuses:

* Unpaid

* Pending Verification

* Active

Generate unique payment references automatically.

Store activation payment records.

---

# IMPORTANT: Configurable Loan Tier Engine

Do NOT hard-code loan limits based on membership fees.

Instead, build a fully configurable Loan Tier Engine.

The Loan Tier Engine must allow administrators to create, edit, activate, deactivate, and delete eligibility tiers without changing code.

Example Tier Structure:

Tier Name:

Starter

Activation Fee:

ZMW 100

Maximum Loan:

ZMW 500

Tier Name:

Growth

Activation Fee:

ZMW 250

Maximum Loan:

ZMW 1,500

Tier Name:

Premium

Activation Fee:

ZMW 500

Maximum Loan:

ZMW 5,000

However, these values must be editable from the admin dashboard.

Future eligibility criteria may include:

* KYC Status

* Activation Status

* Income Level

* Employment Status

* Repayment History

* Previous Loans

* Credit Score

* Risk Rating

The platform must be built so the lending model can evolve without requiring database redesigns or application rewrites.

---

# Loan Eligibility Engine

Build a configurable eligibility system.

Eligibility may consider:

* Activation Tier

* Identity Verification

* Employment Status

* Monthly Income

* Existing Debt

* Repayment History

* Risk Assessment

Administrators must be able to modify rules.

---

# Loan Application Module

Fields:

* Requested Amount

* Loan Purpose

* Employment Status

* Employer Name

* Monthly Income

* Repayment Duration

Workflow:

Draft

→ Submitted

→ Under Review

→ Approved

→ Rejected

→ Disbursed

→ Active

→ Closed

---

# Borrower Dashboard

Display:

* Profile Completion Percentage

* KYC Status

* Activation Status

* Available Loan Limit

* Active Loans

* Outstanding Balance

* Next Due Date

* Recent Transactions

* Notifications

Use charts and KPI cards.

---

# Loan Details Page

Display:

* Principal Amount

* Service Fee

* Interest Amount

* Total Repayment

* Installments

* Due Dates

* Repayment Progress

* Payment History

Generate downloadable agreements.

---

# Repayment Module

Support:

* Airtel Money

* MTN Mobile Money

* Bank Transfer

Features:

* Automatic balance updates

* Payment reconciliation

* Receipts

* Repayment tracking

* Late payment tracking

---

# Notifications

Create a notification center.

Support:

* SMS

* Email

* In-App Notifications

Events:

* Registration Successful

* OTP Verified

* KYC Approved

* KYC Rejected

* Activation Successful

* Loan Submitted

* Loan Approved

* Loan Rejected

* Loan Disbursed

* Repayment Reminder

* Overdue Warning

* Payment Confirmation

---

# Admin Dashboard

Metrics:

* Total Users

* Active Users

* Verified Users

* Activation Revenue

* Active Loans

* Total Loan Value

* Outstanding Balances

* Repayment Performance

* Default Rate

* Monthly Revenue

Management Sections:

* Users

* KYC Reviews

* Loan Applications

* Active Loans

* Repayments

* Transactions

* Notifications

* Loan Products

* Loan Tier Engine

* Eligibility Rules

---

# Database Architecture

Generate a production-ready relational database.

Tables:

* Users

* Profiles

* KYC Documents

* Activation Payments

* Loan Tiers

* Eligibility Rules

* Loan Applications

* Loans

* Repayments

* Transactions

* Notifications

* Audit Logs

* Admin Users

* Countries

* Payment Methods

Include:

* Proper foreign keys

* Indexes

* Constraints

* Audit tracking

* Soft deletes where appropriate

---

# Security

Implement:

* Row Level Security

* Role-Based Access Control

* Secure Authentication

* Session Management

* Audit Logs

* Encryption of Sensitive Data

* Secure File Storage

* Activity Monitoring

---

# Integrations

Prepare integrations for:

* Flutterwave

* Paystack

* SMS Gateway

* Email Provider

All secrets must be stored in environment variables.

---

# Multi-Country Expansion

Design the platform to support:

* Zambia

* Ghana

* Kenya

* Uganda

* Tanzania

All of the following must be configurable per country:

* Currency

* Activation Fees

* Loan Limits

* Eligibility Rules

* Payment Methods

* Mobile Money Providers

* Interest Structures

* Regulatory Requirements

No country-specific logic should be hard-coded.

---

# Technical Requirements

Generate:

* Complete database schema

* Responsive UI

* Production-ready pages

* API architecture

* User workflows

* Admin workflows

* Permission system

* Scalable backend structure

* Fintech-grade user experience

The final result should feel like a real venture-backed digital lending platform ready for MVP launch, investor demonstrations, and future expansion across Africa.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/27ebd73e-98b2-4885-8a56-3ca2d58080db).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
