# Public demo URLs and credentials

> **Public demo environment:** These credentials are intentionally public and
> for this demo project only. Never connect this project to real outlet,
> customer, or payment data. Use different credentials and a different
> database for any non-demo deployment. They are provisioned by
> [`20260904035136_seed_demo_accounts.sql`](../supabase/migrations/20260904035136_seed_demo_accounts.sql).

Start the local apps with `pnpm dev`. The web app is served at
`http://localhost:5173`.

The localhost URLs below are examples. For the deployed Vercel app, use the
same paths appended to its base URL.

## Customer

The seeded customer account is phone-only for now; email can be added later.

| Field    | Seeded value                              |
| -------- | ----------------------------------------- |
| Name     | `Demo Customer`                           |
| Phone    | `+919876543210`                           |
| Password | `customer-demo-password`                  |
| Login    | [`/login`](http://localhost:5173/login)   |
| Signup   | [`/signup`](http://localhost:5173/signup) |

## Staff login

There is one outlet-scoped staff login URL. The server derives the role from the
authenticated account; there is no outlet chooser or role selector.

[`/outlet/demo-spice-garden/login`](http://localhost:5173/outlet/demo-spice-garden/login)

| Role      | Name             | Username    | Password                  | Destination |
| --------- | ---------------- | ----------- | ------------------------- | ----------- |
| admin     | `Owner`          | `owner`     | `owner-demo-password`     | `/admin`    |
| kitchen   | `Demo Kitchen`   | `kitchen`   | `kitchen-demo-password`   | `/kitchen`  |
| waiter    | `Demo Waiter`    | `waiter`    | `waiter-demo-password`    | `/waiter`   |
| reception | `Demo Reception` | `reception` | `reception-demo-password` | `/floor`    |
| cashier   | `Demo Cashier`   | `cashier`   | `cashier-demo-password`   | `/counter`  |

Staff usernames are lowercase. Staff signup is not public: each route is an
admin-protected account-creation screen and fixes the new account's role.

| Role      | Signup URL                                                |
| --------- | --------------------------------------------------------- |
| admin     | [`/admin/signup`](http://localhost:5173/admin/signup)     |
| kitchen   | [`/kitchen/signup`](http://localhost:5173/kitchen/signup) |
| waiter    | [`/waiter/signup`](http://localhost:5173/waiter/signup)   |
| reception | [`/floor/signup`](http://localhost:5173/floor/signup)     |
| cashier   | [`/counter/signup`](http://localhost:5173/counter/signup) |

Signup requires a lowercase username, first name, password, and an optional last
name.

## Customer ordering

The seeded `Spice Garden` outlet supports takeaway and four dine-in table links:

- Takeaway: [`/outlet/demo-spice-garden`](http://localhost:5173/outlet/demo-spice-garden)
- Table 1: [`/outlet/demo-spice-garden/table/t1-demo`](http://localhost:5173/outlet/demo-spice-garden/table/t1-demo)
- Table 2: [`/outlet/demo-spice-garden/table/t2-demo`](http://localhost:5173/outlet/demo-spice-garden/table/t2-demo)
- Table 3: [`/outlet/demo-spice-garden/table/t3-demo`](http://localhost:5173/outlet/demo-spice-garden/table/t3-demo)
- Table 4: [`/outlet/demo-spice-garden/table/t4-demo`](http://localhost:5173/outlet/demo-spice-garden/table/t4-demo)

The base outlet URL starts takeaway ordering. Table URLs require a table-enabled
outlet and open dine-in ordering.
