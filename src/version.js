'use strict';
// Central version + bytecode-format definitions.
//
// The image header is formalized so that future VM generations can coexist and
// be told apart without guessing:
//
//   byte  0..1  magic 'V' 'G'
//   byte  2     format major   (incompatible format changes bump this)
//   byte  3     format minor   (backward-compatible additions bump this)
//   byte  4     flags          (bitfield; see FLAG_*)
//   byte  5     profile        (see PROFILES)
//   byte  6     architecture   (see ARCH)
//   byte  7..10 u32 checksum   (FNV-1a over the header-meta bytes 2..6 + body)
//   byte 11..   body
//
// A decoder validates magic + major before trusting anything else. The four
// independent version numbers below let a host reason about compatibility of the
// compiler, the VM ABI, the bytecode, and the protection scheme separately.

module.exports = {
  MAGIC0: 0x56, // 'V'
  MAGIC1: 0x47, // 'G'

  // On-disk image format. Bump MAJOR only for incompatible layout changes.
  FORMAT_MAJOR: 2,
  FORMAT_MINOR: 0,

  // Independent, separately-evolving component versions (reported by the CLI and
  // available to hosts for compatibility checks / negotiation).
  COMPILER_VERSION: '0.2.0', // source language + codegen
  VM_ABI_VERSION: 2,         // host interface / runtime contract
  BYTECODE_VERSION: 2,       // opcode table + instruction encoding
  PROTECTION_VERSION: 2,     // permutation / cipher / integrity scheme

  // Header flag bits (byte 4).
  FLAG_OPTIMIZED: 0x01, // compile-time optimizer was applied
  FLAG_LIMITED: 0x02,   // runtime resource limits are enforced
  FLAG_SIGNED: 0x04,    // artifact carries a keyed MAC verified at runtime

  // Build profiles (header byte 5).
  PROFILES: { development: 0, balanced: 1, aggressive: 2, performance: 3 },
  PROFILE_NAMES: ['development', 'balanced', 'aggressive', 'performance'],

  // VM architecture (header byte 6). Only the stack/switch VM exists today;
  // the field reserves space so register / threaded / block VMs can coexist.
  ARCH: { 'stack-switch': 0, 'register-threaded': 1, 'register-indirect': 2, 'stack-block': 3 },
  ARCH_NAMES: ['stack-switch', 'register-threaded', 'register-indirect', 'stack-block'],
};

// Per-profile build configuration. `optimize` and `permute` shape the artifact;
// `maxSteps` / `maxDepth` are runtime resource limits embedded into the VM
// (0 = unlimited). These are defaults; explicit CLI flags override them.
module.exports.PROFILE_CONFIG = {
  development: { optimize: false, permute: false, conceal: false, maxSteps: 0, maxDepth: 0, arch: 'stack-switch' },
  balanced: { optimize: true, permute: true, conceal: false, maxSteps: 0, maxDepth: 1024, arch: 'stack-switch' },
  aggressive: { optimize: true, permute: true, conceal: true, maxSteps: 200000000, maxDepth: 512, arch: 'stack-switch' },
  performance: { optimize: true, permute: true, conceal: false, maxSteps: 0, maxDepth: 0, arch: 'stack-switch' },
};
