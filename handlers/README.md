# Shipped agents

Trigger Bindings this realm ships. **Every one of them is `autonomous: false`** — installed, they
appear in the console's Agents tab as *available to adopt*, and until someone adopts one nothing
fires. Adopted, they run observe-only: real reads, real judgement, effects logged rather than
taken, until the user promotes them.

That is the point of shipping them. A realm that installs four event sources and no agents leaves
the user staring at an empty editor being asked to imagine what a GitHub world could do. A realm
that ships its obvious agents turns installation into a menu.

Each binds a signal this realm's `events/` actually produces, so the trigger names in here and the
types in `types/github.yml` cannot drift apart without a test noticing.
