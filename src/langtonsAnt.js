// Langton's Ant, generalized to the hex grid this project already uses
// elsewhere (axial coordinates, the same 6-direction ordering as
// src/engine.js's DIRS — confirmed strictly rotational, 60 degrees per step,
// so "turn right" = +1 index and "turn left" = -1 index are well-defined).
//
// Fundamentally a different kind of automaton from the density/energy/
// momentum field engine: a single discrete walker that reads and writes one
// cell per step, not a parallel field-update rule — so it gets its own grid
// representation rather than reusing Engine.
//
// The grid is a sparse, logically infinite plane (a Map keyed by "q,r"),
// not the rest of the project's fixed toroidal array. Langton's Ant is
// famous for eventually walking a straight "highway" that can travel
// thousands of cells from the origin; a fixed-size wrapped grid would let
// that highway wrap around and collide with its own earlier trail, which
// isn't how the real automaton behaves and would corrupt exactly the
// long-run behavior worth observing. Unvisited cells are implicitly state 0
// (absent from the map) — cheap for the vast, untouched majority of the plane.
import { DIRS } from './engine.js';

// Rule string: one L/R character per cell state. State 0 uses rule[0], state
// 1 uses rule[1], etc. Number of states = rule.length. After acting on a
// cell, its state advances to (state + 1) % rule.length. The classic
// 2-state "LR" rule is Langton's original ant.
export function parseRule(ruleString) {
  const rule = ruleString.trim().toUpperCase().split('');
  if (rule.length < 1) throw new Error('Rule string must have at least one character');
  for (const c of rule) {
    if (c !== 'L' && c !== 'R') throw new Error(`Rule string may only contain L/R, got "${c}"`);
  }
  return rule;
}

function key(q, r) {
  return `${q},${r}`;
}

export class LangtonsAnt {
  constructor(ruleString = 'LR', { startDir = 0 } = {}) {
    this.rule = parseRule(ruleString);
    this.ruleString = this.rule.join('');
    this.states = this.rule.length;

    this.cells = new Map(); // "q,r" -> state (1..states-1; state 0 is never stored)
    this.q = 0;
    this.r = 0;
    this.dir = ((startDir % 6) + 6) % 6;
    this.steps = 0;

    this.minQ = this.maxQ = 0;
    this.minR = this.maxR = 0;
  }

  getState(q, r) {
    return this.cells.get(key(q, r)) || 0;
  }

  step() {
    const k = key(this.q, this.r);
    const state = this.cells.get(k) || 0;
    const turn = this.rule[state];
    this.dir = turn === 'R' ? (this.dir + 1) % 6 : (this.dir + 5) % 6;

    const nextState = (state + 1) % this.states;
    if (nextState === 0) this.cells.delete(k);
    else this.cells.set(k, nextState);

    const [dq, dr] = DIRS[this.dir];
    this.q += dq;
    this.r += dr;

    if (this.q < this.minQ) this.minQ = this.q;
    if (this.q > this.maxQ) this.maxQ = this.q;
    if (this.r < this.minR) this.minR = this.r;
    if (this.r > this.maxR) this.maxR = this.r;

    this.steps++;
  }

  stepN(n) {
    for (let i = 0; i < n; i++) this.step();
  }

  // Net displacement of the ant from the origin — growing roughly linearly
  // with step count is the signature of a "highway" (the ant has locked into
  // a repeating translate-and-rotate cycle); staying bounded means the
  // pattern hasn't (yet) escaped into unbounded directional drift.
  displacement() {
    return Math.hypot(this.q, this.r);
  }

  visitedCount() {
    return this.cells.size;
  }
}
