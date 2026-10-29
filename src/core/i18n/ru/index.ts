/**
 * The Russian dictionary (ADR-153), one file per area so changes do not collide. `ru` holds text written in the
 * code (typed keys for `t`); `ruData` holds text from built-in data (looked up by `tr`, ADR-155).
 */
import { ru_account } from './account';
import { ru_base } from './base';
import { ru_catalog } from './catalog';
import { ru_core } from './core';
import { ru_core2 } from './core2';
import { data_catalog } from './data-catalog';
import { data_parts } from './data-parts';
import { data_research1 } from './data-research1';
import { data_research2 } from './data-research2';
import { data_wizard } from './data-wizard';
import { ru_editors } from './editors';
import { ru_info } from './info';
import { ru_inspector } from './inspector';
import { ru_project } from './project';
import { ru_research } from './research';
import { ru_shell } from './shell';
import { ru_viewer } from './viewer';
import { ru_wizard } from './wizard';

export const ru = {
  ...ru_base,
  ...ru_shell,
  ...ru_project,
  ...ru_inspector,
  ...ru_research,
  ...ru_viewer,
  ...ru_catalog,
  ...ru_editors,
  ...ru_account,
  ...ru_core,
  ...ru_core2,
  ...ru_info,
  ...ru_wizard,
};

export const ruData: Record<string, string> = {
  ...data_parts,
  ...data_catalog,
  ...data_wizard,
  ...data_research1,
  ...data_research2,
};
