You are a senior full-stack software architect and engineer. We are building a secure, multi-user, web-based customer pricing analysis platform called **Sympl PAS**.

# Project Name

**Sympl PAS**
**Sympl Pricing Analysis System**

# Product Purpose

Sympl PAS is a customer-specific pricing, cost, shipping, profitability, and margin analysis platform.

The system will combine:

* Customer pricing requirements
* Customer-specific costs and allocations
* Product costs and physical dimensions
* Commercial shipping-rate quotes
* SKU assignments
* Minimum profit-margin requirements
* SKU-level profitability calculations
* Alerts and exception management
* Comments, tagging, and collaboration
* Scheduled and exportable reporting

The primary purpose is to help sales managers, pricing analysts, and company leadership evaluate the financial health of customer programs at the individual SKU level.

# Initial Development Objective

Begin by designing and scaffolding the application architecture.

Before implementing advanced features, create:

1. A recommended technical architecture
2. The database schema and relationships
3. The user-role and permission model
4. The calculation engine design
5. The shipping-rate integration architecture
6. The import/export architecture
7. The alert and notification architecture
8. The reporting architecture
9. The application navigation and page structure
10. A phased implementation plan

Do not attempt to build the entire application in a single uncontrolled pass.

Use modular, maintainable, production-oriented patterns. Document important assumptions and architectural decisions.

# Application Type

* Web-based application
* Multi-user
* Role-based access control
* Customer-level data security
* Responsive desktop-first interface
* Designed for large SKU datasets
* Secure handling of confidential cost and pricing information
* Background jobs for reports, imports, shipping quotes, alerts, emails, and backups

# Core Security Requirement

Users may only view customers to which they have been explicitly assigned.

This restriction must be enforced at the backend authorization layer and must not rely only on hiding interface elements.

A user who is not assigned to a customer must not be able to:

* View the customer profile
* View the customer’s assigned SKUs
* View the customer’s ROI analysis
* View comments associated with that customer
* View reports containing that customer
* Access the customer through manually entered URLs
* Retrieve the customer through API requests
* Search for the customer or its restricted data

Administrators and authorized directors may have global access based on role permissions.

# User Roles

Design the authorization system so permissions are configurable and not unnecessarily hard-coded.

Initial roles:

## Administrator

Full system access, including:

* User administration
* Role and permission administration
* Customer access assignments
* Product administration
* Cost visibility
* System configuration
* Shipping API configuration
* SMTP configuration
* Backup configuration
* Import/export tools
* Audit logs
* Reports
* All customer records

## Director

Executive-level access, including:

* All assigned or globally authorized customers
* Product cost visibility
* ROI and financial data
* Reports and dashboards
* Alerts
* Comments
* Exports
* Customer and product review

Directors should not automatically receive infrastructure-level configuration permissions unless specifically granted.

## Sales Manager

Access to assigned customers and the users or analysts working on those customers.

Possible capabilities:

* View assigned customer profiles
* View customer pricing and profitability
* Manage customer SKU assignments
* Review alerts
* Add comments
* Tag users
* Export customer reports
* Assign analysts where permitted
* Review pricing recommendations

## Pricing Analyst

Access only to assigned customers.

Possible capabilities:

* View permitted customer information
* View assigned SKU data
* Review ROI calculations
* Review and resolve alerts
* Add line-level comments
* Tag permitted users
* Run or request shipping-rate updates
* Import permitted pricing data
* Export permitted reports

## Cost Visibility Rule

Product cost is highly confidential.

By default, raw product cost should only be visible to:

* Administrators
* Directors
* Any additional roles explicitly granted a `view_product_cost` permission

Users without cost visibility may still be permitted to see approved calculated outputs such as margin percentage or alert status, but raw cost must not be exposed through:

* User interface fields
* API responses
* Downloaded reports
* Browser source
* Hidden columns
* Client-side data payloads
* Logs available to unauthorized users

Design separate permissions for:

* Viewing raw cost
* Editing raw cost
* Viewing calculated margin
* Exporting financial data
* Viewing shipping cost
* Viewing customer pricing

# Customer Profiles

Each customer must exist as its own record.

Customer profiles should support the following fields and related records.

## Customer Identity

* Customer name
* Customer code or internal identifier
* Status
* Description
* Primary contacts
* Internal account owner
* Assigned sales manager
* Assigned analysts
* Currency
* Time zone
* Active/inactive state

## Pricing Information

* Customer price list
* Effective date
* Expiration date
* Customer-specific selling price by SKU
* Future or proposed price
* Price source
* Pricing notes
* Price-list version
* Import batch reference

The architecture should allow pricing to change over time while preserving history.

Do not overwrite historical prices without retaining effective dates or version records.

## Payment Terms

Examples may include:

* Net 30
* Net 60
* Net 90
* Due on receipt
* Custom terms

Design payment terms as configurable records rather than relying entirely on free text.

Future calculations may assign a financial carrying cost to payment terms, so the data model should support:

* Number of days
* Discount percentage
* Discount period
* Custom financing-cost rules

## Shipping Terms

At minimum:

* Prepaid
* Collect

The system should support additional configurable terms in the future.

For **Prepaid** customers, the system will include calculated shipping expense in profitability analysis.

For **Collect** customers, shipping should generally not be included as a seller-paid expense unless a customer-specific rule or exception says otherwise.

## Customer Allocations and Other Costs

Customer profiles must support multiple configurable allocations and costs.

An allocation may be:

* A percentage of selling price
* A percentage of another financial basis
* A fixed amount per unit
* A fixed amount per order
* A fixed amount per shipment
* A fixed amount per SKU
* A custom calculation basis

Examples include:

* Commissions
* Rebates
* Marketing allowances
* Damage allowances
* Defect allowances
* Compliance allowances
* Early-payment discounts
* Distribution allowances
* Handling fees
* Marketplace fees
* Program fees
* Administrative charges
* Other customer-specific expenses

Each allocation or cost record should support:

* Name
* Description
* Calculation type
* Rate or amount
* Calculation basis
* Effective date
* Expiration date
* Priority or calculation order
* Active/inactive status
* Whether it is included in margin calculations
* Whether it is displayed separately in reports

Avoid designing the system around only one generic allocation field.

## Minimum Profit Margin Requirements

Each customer must have a default minimum profit-margin requirement.

Support:

* Minimum margin percentage
* Optional minimum profit dollars
* Warning threshold
* Critical threshold
* Effective date
* Calculation method
* Notes

## Assigned SKUs

Products can be assigned to one or more customers.

The customer-product relationship must support customer-specific information such as:

* Customer
* Product
* Customer SKU
* Internal SKU
* Customer selling price
* Proposed selling price
* Effective date
* Active/inactive status
* Customer-specific minimum margin override
* Customer-specific fixed costs
* Customer-specific shipping override
* Customer-specific package quantity
* Customer-specific unit of measure
* Alert status
* Review status
* Assigned analyst
* Last analysis date
* Last shipping-quote date
* Notes

The relationship between customers and products should be modeled as a dedicated entity rather than a simple many-to-many lookup table.

# Product Records

Products must exist independently from customer records.

Each product should support:

## Product Identity

* Internal SKU
* Product name
* Brand
* UPC or GTIN
* Product category
* Product subcategory
* Status
* Active/discontinued state
* Description
* Unit of measure
* Case pack where applicable

## Confidential Financial Fields

* Current product cost
* Cost effective date
* Future cost
* Future cost effective date
* Cost source
* Cost history

Product costs must support historical records and effective dates.

## UPC or Product Dimensions

The requested initial fields are:

* UPC length
* UPC width
* UPC height
* UPC weight

Treat these as the dimensions and weight of the individual product or retail unit.

## Shipping Dimensions

* Shipping length
* Shipping width
* Shipping height
* Shipping weight

These represent the dimensions and weight used for parcel-rate calculations.

## Shipping-Dimension Fallback Rule

Use shipping dimensions and shipping weight when they are available and valid.

When shipping dimensions are unavailable, use the UPC or product dimensions and weight as the fallback.

The system must clearly record which data source was used:

* Shipping dimensions
* UPC dimensions
* Derived dimensions
* Manually overridden dimensions

## Dunnage Rule

When shipping dimensions are unavailable and UPC dimensions are used, apply a configurable dunnage percentage or dimensional adjustment.

The dunnage configuration should support one or more of the following:

* Global default
* Product-category default
* Customer-specific default
* Product-specific override

Do not permanently alter the source UPC dimensions when applying dunnage.

Store or calculate separate adjusted shipping dimensions.

Clearly define how dunnage affects dimensions. For example, the system may apply a percentage to each dimension rather than only increasing cubic volume. Make this behavior configurable and documented.

## Product Data Import and Export

Product data must support a repeatable loop import/export workflow:

1. Export current system data
2. Allow authorized users to edit the exported file
3. Re-import the revised file
4. Validate changes
5. Preview additions, updates, errors, and conflicts
6. Require confirmation before committing changes
7. Preserve an audit trail
8. Provide a downloadable error file
9. Record import batch history
10. Allow rollback or correction where practical

Expected formats:

* Excel `.xlsx`
* CSV where useful

Imports should support:

* New records
* Updates
* No-change records
* Invalid records
* Duplicate detection
* Required-field validation
* Data-type validation
* Unit validation
* Cost-permission validation
* Partial success where appropriate

Do not allow unauthorized users to update or infer confidential product costs through imports or exports.

# Shipping-Rate APIs

The system must integrate with:

* USPS APIs
* UPS APIs

Use the current supported commercial shipping APIs and isolate each carrier behind a common internal interface.

Do not tightly couple profitability calculations directly to either carrier’s response format.

Create a carrier-rate service layer such as:

* `ShippingRateProvider`
* `UPSRateProvider`
* `USPSRateProvider`
* `ShippingRateService`
* `PackageDimensionResolver`
* `DimensionalWeightCalculator`

## Shipping Quote Inputs

Quotes may require:

* Origin postal code
* Destination postal code
* Residential or commercial destination
* Package dimensions
* Package weight
* Package quantity
* Service level
* Negotiated or commercial account credentials
* Pickup type
* Packaging type
* Ship date
* Customer-specific shipping assumptions

Customer records should support a default destination or shipping-zone methodology.

Because actual order destinations may vary, design the shipping assumptions so the system can support:

* Customer default destination postal code
* Distribution-center postal codes
* Weighted destination zones
* Average historical shipping cost
* Fixed shipping override
* Multiple quote scenarios
* A conservative or worst-case shipping method

Do not assume a single destination model is sufficient for every customer.

## Commercial Rates

The shipping system should request authenticated commercial or negotiated rates where supported.

Store:

* Carrier
* Service
* Base rate
* Surcharges
* Discounts
* Total quoted rate
* Quote timestamp
* Request assumptions
* Package dimensions used
* Package weight used
* Dimensional weight
* Billable weight
* Origin
* Destination
* Raw provider response or sanitized diagnostic data
* Expiration or refresh status

Sensitive API credentials must be encrypted and stored securely.

## Dimensional Weight

Build a configurable dimensional-weight calculation engine.

Support carrier-specific divisors and rules rather than assuming one universal divisor.

Record:

* Actual weight
* Dimensional weight
* Billable weight
* Dimensional divisor
* Carrier rule used
* Rounding method

The carrier-returned billable rate should be treated as authoritative when available, while internal dimensional calculations can be used for validation, forecasting, and diagnostics.

## Quote Selection

The system should support selecting a shipping cost based on configurable rules, such as:

* Cheapest eligible service
* Preferred service
* Specific service level
* Cheapest service meeting delivery requirements
* Customer-specific service rule
* Manually selected quote
* Fixed shipping override

Persist the selected quote and the reason it was selected.

## Quote Refreshing

Shipping quotes can become stale.

Support:

* Manual quote refresh
* Bulk quote refresh
* Scheduled quote refresh
* Quote expiration rules
* Background queue processing
* Failure retries
* Rate limiting
* API error logging
* Notification of failed quote batches

The user interface should show the quote date and stale status.

# Profitability and ROI Calculation Engine

Create a dedicated server-side calculation engine.

Calculations must not exist only in front-end JavaScript.

The engine should accept versioned input data and produce a traceable calculation result.

At minimum, calculate:

* Customer selling price
* Product cost
* Shipping cost
* Percentage allocations
* Fixed allocations
* Other customer costs
* Total deductions
* Gross profit dollars
* Gross margin percentage
* Profit after customer costs
* Final contribution dollars
* Final contribution margin percentage
* Minimum required margin
* Variance from required margin
* Alert status

Provide configurable formulas and clearly define the default calculation.

A suggested default calculation is:

`Net Revenue = Selling Price - Revenue-Based Allowances`

`Total Variable Cost = Product Cost + Seller-Paid Shipping + Fixed Per-Unit Costs + Other Applicable Costs`

`Contribution Profit = Net Revenue - Total Variable Cost`

`Contribution Margin % = Contribution Profit / Net Revenue × 100`

However, some companies calculate margin using gross selling price rather than net revenue. Design the calculation engine so the denominator and allocation basis are explicit and configurable.

## Calculation Trace

For every analyzed customer SKU, retain a calculation trace containing:

* Input values
* Input record versions
* Formulas used
* Intermediate values
* Final values
* Applied customer rules
* Applied SKU overrides
* Shipping quote used
* Calculation timestamp
* Calculation-engine version
* User or process that initiated the calculation

This is essential for auditability and troubleshooting.

## Calculation Precedence

Define a consistent rule-precedence model.

A suggested precedence order is:

1. Customer-SKU manual override
2. Product-specific rule
3. Customer-specific rule
4. Product-category rule
5. Global system default

Make precedence explicit and reusable across:

* Minimum margins
* Dunnage
* Shipping assumptions
* Allocation rules
* Quote-selection rules
* Alert thresholds

# ROI Grid View

Create a customer-specific ROI and financial-analysis grid.

The grid should provide a holistic line-level view of every assigned SKU for a selected customer.

## Grid Requirements

* High-performance data grid
* Server-side pagination
* Server-side sorting
* Server-side filtering
* Saved views
* Column customization
* Column resizing
* Column pinning
* Bulk selection
* Export of filtered results
* Permission-aware columns
* Large-dataset support
* Persistent user preferences

## Suggested Columns

* Alert status
* Review status
* Internal SKU
* Customer SKU
* Product name
* Brand
* Product category
* Customer price
* Proposed price
* Product cost, when authorized
* Shipping terms
* Shipping cost
* Shipping carrier
* Shipping service
* Shipping quote date
* Shipping-quote status
* Total percentage allocations
* Total fixed allocations
* Other costs
* Total landed or program cost
* Profit dollars
* Margin percentage
* Required minimum margin
* SKU-level minimum-margin override
* Variance to minimum
* Assigned analyst
* Last analyzed date
* Comment count
* Unresolved mention count

## Grid Filters

At minimum:

* Individual SKU
* Bulk SKU list
* Customer SKU
* Product category
* Product subcategory
* Brand
* Alert status
* Review status
* Margin range
* Profit-dollar range
* Assigned analyst
* Shipping-quote status
* Missing-data status
* Active/inactive status

Bulk SKU filtering should support pasting a list of SKUs separated by:

* New lines
* Commas
* Tabs
* Spaces where safe

## Bulk Actions

Possible bulk actions:

* Refresh shipping quotes
* Recalculate selected SKUs
* Assign analyst
* Update review status
* Add a shared comment
* Export selected records
* Apply an approved margin override
* Mark alerts as reviewed
* Request pricing review

Sensitive bulk changes should require confirmation and create audit records.

# Comments, Mentions, and Notifications

Allow line-level comments on each customer-SKU record.

Comments should support:

* Plain text or safe rich text
* User mentions
* Timestamps
* Editing rules
* Soft deletion
* Attachments in a future phase
* Resolved/unresolved status
* Comment threads or replies
* System-generated calculation notes
* Links to the applicable customer and SKU

Users may only tag users who are authorized to access that customer.

Do not notify or expose customer information to users without customer access.

## Notifications

Support:

* In-app notifications
* Email notifications
* Mention notifications
* Alert assignment notifications
* Report delivery notifications
* Import completion notifications
* Shipping-quote failure notifications
* Optional digest notifications

Each user should be able to configure permitted notification preferences.

# Analysis and Alert System

For each customer, analyze every assigned SKU using:

* Customer pricing
* Product cost
* Customer allocations
* Customer other costs
* Shipping terms
* Applicable shipping quote
* Product dimensions
* Customer minimum margin
* Customer-SKU minimum-margin override
* Applicable calculation rules

## Primary Profitability Alert

Flag a SKU when its calculated margin is below:

* The customer’s default minimum margin, or
* The customer-SKU minimum-margin override when one exists

The SKU-level override should take precedence over the customer default.

## Suggested Alert Types

* Below minimum margin
* Below critical margin
* Negative profit
* Missing selling price
* Missing product cost
* Missing product dimensions
* Missing shipping dimensions
* UPC dimensions used as fallback
* Dunnage assumption applied
* Missing shipping quote
* Stale shipping quote
* Shipping API failure
* Missing allocation configuration
* Expired price
* Future price pending
* Expired cost
* Unassigned analyst
* Data conflict
* Import validation error
* Margin changed materially since previous analysis

## Alert Statuses

Suggested statuses:

* New
* Open
* In Review
* Awaiting Information
* Action Required
* Resolved
* Dismissed
* Reopened

Retain alert history.

Do not permanently delete an alert merely because a recalculation resolves the condition. Mark it resolved and preserve the history.

## Alert Severity

Suggested levels:

* Informational
* Warning
* High
* Critical

Severity rules should be configurable.

# User Dashboard

Design a useful role-aware dashboard.

The dashboard should not display unauthorized customer information.

## Suggested Dashboard Components

### Portfolio Summary

* Number of assigned customers
* Number of assigned SKUs
* Total annualized or current revenue, where available
* Average margin
* Total profit dollars
* Percentage of SKUs meeting margin requirements
* Percentage of SKUs below margin requirements

### Alert Summary

* New alerts
* Critical alerts
* SKUs below minimum margin
* Negative-profit SKUs
* Missing-data alerts
* Stale shipping quotes
* Recently resolved alerts

### Margin Distribution

* SKUs above requirement
* SKUs near requirement
* SKUs below requirement
* SKUs with negative margin
* SKUs that cannot be calculated

### Customer Health

For each authorized customer:

* SKU count
* Average margin
* Number below minimum
* Number of critical alerts
* Last analysis date
* Data completeness
* Shipping-quote freshness

### Work Queue

* Alerts assigned to the user
* Customer SKUs awaiting review
* Unresolved mentions
* Failed imports
* Shipping quote failures
* Reports requiring review
* Recently changed pricing or costs

### Recent Activity

* Comments
* Mentions
* Imports
* Price changes
* Cost changes, only when authorized
* Margin changes
* Alert resolutions
* Customer assignments

### Quick Actions

* Select customer
* Import data
* Export ROI report
* Refresh shipping quotes
* Recalculate customer
* Review critical alerts
* Open assigned work queue

# Reports

Support both scheduled emailed reports and on-demand exportable Excel reports.

## Weekly Scheduled Report

Generate through a scheduled background job or cron process.

The schedule should be configurable by administrators.

Support:

* Weekly day and time
* Time zone
* Recipient list
* Customer access validation
* Report filters
* Report format
* Failure notifications
* Delivery history
* Manual rerun

Reports must never include customer or cost data that the recipient is not authorized to view.

## Excel Workbook Structure

The initial workbook should contain:

### Summary Tab

Suggested content:

* Report date
* Reporting period
* Customers included
* Total SKU count
* SKUs meeting margin
* SKUs below margin
* Negative-profit SKUs
* Missing-data SKUs
* Average margin
* Total profit dollars
* Critical-alert count
* Shipping-quote freshness
* Customer-level summary table

### Customer Tabs

Create one tab per included customer:

* Customer 1 SKU List & Data
* Customer 2 SKU List & Data
* Customer 3 SKU List & Data
* Continue dynamically for all included customers

Use sanitized and Excel-safe worksheet names.

Each customer tab should contain the applicable ROI-grid data, subject to user permissions.

## Report Features

* Freeze headers
* Enable filters
* Format percentages
* Format currency
* Use readable column widths
* Highlight alerts
* Include generated timestamp
* Include calculation version
* Include quote date
* Include data-quality indicators
* Respect cost-visibility permissions
* Export only authorized records
* Support filtered exports
* Support selected-row exports

# Administration

## User Administration

Support:

* Create users
* Edit users
* Activate/deactivate users
* Assign roles
* Assign permissions
* Assign customers
* Assign managers
* Assign analysts
* Force password reset
* View last login
* Review account status
* Review audit history

## Authentication

Include:

* Secure login
* Password recovery
* Password-reset tokens with expiration
* Password hashing using a modern secure algorithm
* Session management
* Account lockout or throttling
* Optional multi-factor authentication architecture
* Optional SSO architecture for a future phase

## SMTP and Email Configuration

Administrative configuration should support:

* SMTP host
* SMTP port
* Encryption type
* Username
* Password or secret
* From name
* From address
* Reply-to address
* Test email
* Delivery logs
* Retry handling

Secrets must be encrypted and must never be returned to the browser after storage.

## Shipping API Configuration

Support separate secure configuration for:

* UPS credentials
* USPS credentials
* Account numbers
* API endpoints
* Sandbox/test mode
* Production mode
* Default origin
* Default rate preferences
* Timeout settings
* Retry settings

## Scheduled Backups

Provide scheduled backup configuration.

Backups should include:

* Database
* Required application storage
* Configuration excluding unencrypted secrets
* Import history where applicable
* Report metadata
* Audit history

Support:

* Configurable schedule
* Retention policy
* Backup status
* Failure notification
* Encrypted backup storage
* Restore documentation
* Restore testing procedure

Do not implement backups as an unverified file copy only. Include a strategy for restoration and validation.

# Audit Logging

Create an immutable or append-oriented audit log for sensitive actions.

Track:

* User login events
* Failed login events
* User changes
* Role changes
* Permission changes
* Customer assignments
* Customer profile changes
* Price changes
* Product cost changes
* Product dimension changes
* Allocation changes
* Margin-requirement changes
* SKU override changes
* Imports
* Exports
* Shipping-quote requests
* Manual calculation requests
* Alert-status changes
* Report generation
* Backup events
* Configuration changes

Each audit record should capture:

* User
* Action
* Entity type
* Entity ID
* Timestamp
* Before value where appropriate
* After value where appropriate
* Source IP where appropriate
* Request or correlation ID
* Import batch or job ID where applicable

Sensitive secrets must not appear in logs.

# Data History and Versioning

Preserve history for values that affect profitability:

* Customer prices
* Product costs
* Allocations
* Other costs
* Minimum-margin requirements
* SKU-level overrides
* Shipping quotes
* Calculation outputs
* Product dimensions
* Customer shipping terms

A user should be able to understand why a SKU produced a particular margin result at a particular time.

# Background Jobs

Use a proper queue or job system for:

* Shipping-rate requests
* Bulk recalculations
* Large imports
* Large exports
* Weekly reports
* Email notifications
* Alert generation
* Quote expiration checks
* Scheduled backups

Jobs should support:

* Status
* Progress
* Retry count
* Failure reason
* Created timestamp
* Started timestamp
* Completed timestamp
* Initiating user
* Correlation ID

Do not perform large customer recalculations synchronously inside ordinary HTTP requests.

# Units and Data Normalization

Define canonical units for internal storage.

Recommended examples:

* Dimensions stored in decimal inches or a documented base unit
* Weight stored in decimal pounds or ounces with explicit unit metadata
* Currency stored as fixed-precision decimals
* Percentages stored consistently as decimals or percentage values

Never use binary floating-point types for money.

Imports must validate and convert supported units.

# Data Integrity

Include database constraints and application validation for:

* Unique internal SKUs
* Valid UPC or GTIN formats where supplied
* Positive dimensions
* Positive weights
* Valid percentage ranges
* Valid effective-date ranges
* Valid customer assignments
* Valid product assignments
* No unauthorized cost updates
* No circular role or manager relationships
* No duplicate active customer-SKU assignments unless intentionally versioned

Use soft deletion where historical references must be preserved.

# Search

Provide permission-aware search for:

* Customers
* Internal SKUs
* Customer SKUs
* UPCs
* Product names
* Product categories
* Alerts
* Comments

Search results must never reveal restricted customers.

# Suggested Main Navigation

* Dashboard
* Customers
* Products
* ROI Analysis
* Alerts
* Reports
* Imports & Exports
* Notifications
* Administration
* Audit Log
* User Profile

Navigation must be role-aware.

# API Design

Use a documented, versioned API.

Requirements:

* Server-side authorization on every endpoint
* Input validation
* Pagination
* Filtering
* Sorting
* Consistent error responses
* Rate limiting where appropriate
* Idempotency for imports and selected job requests
* Correlation IDs
* API documentation
* Automated tests

Never expose confidential fields merely because the front end does not display them.

# User Interface Expectations

The interface should feel like a modern financial operations platform.

Prioritize:

* Clear customer context
* Dense but readable financial data
* Fast filtering
* Visible alert severity
* Transparent calculation detail
* Permission-aware actions
* Accessible keyboard navigation
* Responsive layouts
* WCAG-conscious components
* Confirmation for destructive or sensitive actions
* Clear loading, empty, success, and error states

Users should be able to click a calculated margin or profit value and view a detailed calculation breakdown.

# Calculation Detail Panel

For an individual customer SKU, provide a detail view or drawer showing:

* Selling price
* Product cost
* Each allocation
* Each fixed cost
* Shipping cost
* Shipping assumptions
* Carrier and service
* Actual weight
* Dimensional weight
* Billable weight
* Total cost
* Profit dollars
* Margin percentage
* Required margin
* Margin variance
* Applied overrides
* Missing-data warnings
* Formula explanation
* Calculation timestamp
* Calculation version

# Nonfunctional Requirements

The application should be:

* Secure
* Auditable
* Maintainable
* Scalable
* Testable
* Accessible
* Responsive
* Resilient to external API failures
* Capable of processing large product lists
* Designed to prevent cross-customer data leakage

# Testing Requirements

Include tests for:

* Role permissions
* Customer assignment restrictions
* Cost-field restrictions
* API authorization
* Import validation
* Calculation formulas
* Allocation precedence
* Minimum-margin overrides
* Prepaid versus collect shipping
* Shipping-dimension fallback
* Dunnage calculations
* Dimensional weight
* Quote selection
* Alert creation and resolution
* Report permissions
* Exported cost restrictions
* User tagging restrictions
* Scheduled report generation
* Backup job execution

Customer-isolation and cost-confidentiality tests are critical.

# Seed Data

Create realistic development seed data containing:

* Multiple users with different roles
* At least three customers
* Users assigned to different customers
* Users with and without cost visibility
* Multiple product categories
* Products with complete shipping dimensions
* Products with only UPC dimensions
* Products with missing dimensions
* Prepaid customers
* Collect customers
* Percentage allocations
* Fixed allocations
* Customer minimum margins
* SKU-level margin overrides
* Profitable SKUs
* Below-margin SKUs
* Negative-profit SKUs
* Missing-data alerts
* Comments and mentions

Seed data must demonstrate that unauthorized users cannot view unassigned customers.

# Architecture Guidance

Recommend an appropriate stack based on maintainability, security, reporting, background jobs, and data-grid performance.

Favor:

* A mature server-side framework
* A relational database
* Strong migration support
* Queue and scheduler support
* Well-supported authentication and authorization
* Secure secret handling
* A modern front-end framework
* A robust data-grid component
* Reliable Excel generation
* Automated testing

Do not choose technologies solely because they are fashionable.

Explain the tradeoffs of the recommended stack before scaffolding.

# Initial Deliverables

Produce the following before implementing major business features:

1. `README.md`
2. Product requirements summary
3. Architecture decision document
4. Entity relationship model
5. Proposed database tables
6. Roles and permissions matrix
7. Customer-access authorization rules
8. Cost-visibility authorization rules
9. Profitability formula specification
10. Shipping-rate service design
11. Import/export workflow specification
12. Alert lifecycle specification
13. Reporting design
14. Background-job design
15. Application route map
16. Phased development plan
17. Initial project scaffold
18. Environment-variable example file
19. Local development instructions
20. Initial automated test structure

# Suggested Implementation Phases

## Phase 1: Foundation

* Project scaffold
* Database
* Authentication
* Roles and permissions
* Customer assignments
* Audit framework
* Base navigation
* Automated authorization tests

## Phase 2: Customer and Product Data

* Customer profiles
* Product records
* Customer-SKU assignments
* Cost-history records
* Price-history records
* Allocation rules
* Margin requirements
* Import/export foundation

## Phase 3: Calculation Engine

* Calculation inputs
* Formula engine
* Calculation trace
* Margin requirements
* SKU overrides
* Recalculation jobs
* Unit tests

## Phase 4: Shipping

* Dimension resolver
* Dunnage rules
* Dimensional-weight calculations
* UPS integration
* USPS integration
* Quote storage
* Quote refresh jobs
* Prepaid/collect handling

## Phase 5: ROI Grid and Alerts

* Customer ROI grid
* Filters
* Saved views
* Bulk actions
* Alert generation
* Alert workflow
* Calculation detail panel

## Phase 6: Collaboration

* Comments
* Threads
* Mentions
* In-app notifications
* Email notifications
* Assignment workflows

## Phase 7: Reporting

* Excel exports
* Summary worksheet
* Customer worksheets
* Scheduled weekly reports
* Report delivery logs
* Permission-aware exports

## Phase 8: Administration and Operations

* SMTP settings
* Carrier settings
* Backup scheduling
* Restore documentation
* Job monitoring
* Expanded audit interface
* Security hardening

# Working Rules for Claude Code

* Inspect the existing repository before making assumptions.
* Do not remove or overwrite working code without explaining why.
* Keep changes modular and reviewable.
* Use database migrations.
* Use fixed-precision decimal types for financial values.
* Use server-side authorization.
* Never expose unauthorized customer or cost data in API responses.
* Never place API credentials directly in source code.
* Add automated tests with each major feature.
* Keep documentation synchronized with implementation.
* Clearly identify assumptions, risks, and unresolved decisions.
* Run relevant tests, formatting, linting, and type checks after changes.
* Report files created or modified after each implementation stage.
* Do not use placeholder logic for financial calculations without labeling it clearly.
* Do not silently invent business formulas.
* Centralize calculation rules and precedence.
* Centralize permission checks.
* Centralize carrier integrations behind shared interfaces.
* Preserve historical financial inputs and calculation outputs.

# First Task

Start by reviewing the repository and responding with:

1. Your understanding of Sympl PAS
2. Any important assumptions you are making
3. Recommended technology stack
4. High-level system architecture
5. Proposed database entities and relationships
6. Proposed role and permission model
7. Proposed profitability formula and calculation flow
8. Proposed shipping-rate workflow
9. Key security risks and mitigations
10. Phased implementation plan
11. Recommended first development milestone

After presenting this plan, create the foundational documentation and initial project scaffold unless the existing repository indicates a different approach is required.

Do not begin UPS or USPS production integration until the abstraction layer, data model, credential strategy, and mock-provider tests are established.
