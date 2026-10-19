# Pr0 Ecosystem Architecture Map

While you are strictly confined to your current project root (`./`) per the Sandboxing Directive, be aware of how sibling repositories in the architecture connect via APIs/contracts:

- **Sovereign Suite**:
  - `sovereign-os-core` (Core OS kernel/orchestration)
  - `sovereign-brain` (AI reasoning & memory layer)
  - `sovereign-vault` (Encrypted credential & data storage)
  - `Sovereign Sec` (Security enforcement & auditing)
- **GRIDD Suite**:
  - `GRIDD` (Main platform/interface)
  - `GRIDD-MIND` (Cognitive/AI engine for GRIDD)
- **ComplianceLabs Suite**:
  - `compliancelabs-frontend` (Public/Client Web UI)
  - `clc-intelligence-node` (Backend intelligence & compliance engine)
- **Core App Stack**:
  - `frontend` <-> `backend` <-> `engine`
- **Autonomous & Specialized Systems**:
  - `NOVA`, `KAIJU`, `leak-sentinel`, `Blademail`, `API ULTD`, `BotProject`, `projectMetro`, `project.m`
