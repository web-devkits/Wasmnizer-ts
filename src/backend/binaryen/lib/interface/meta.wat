(module
 (type $i32_i32_i32_=>_i32 (func (param i32 i32 i32) (result i32)))
 (type $i32_i32_=>_i32 (func (param i32 i32) (result i32)))
 (import "env" "strcmp" (func $strcmp (param i32 i32) (result i32)))
 (memory $0 1)
 (export "memory" (memory $0))
 (export "find_property_flag_and_index" (func $find_property_flag_and_index))
 (export "find_property_type" (func $find_property_type))
 (func $find_property_flag_and_index (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (block $label$1
   (if
    (i32.gt_s
     (local.tee $4
      (i32.load offset=8
       (local.get $0)
      )
     )
     (i32.const 0)
    )
    (block
     (local.set $0
      (i32.add
       (local.get $0)
       (i32.const 16)
      )
     )
     (local.set $6
      (i32.eq
       (local.tee $5
        (i32.and
         (local.get $2)
         (i32.const 15)
        )
       )
       (i32.const 4)
      )
     )
     (loop $label$3
      (local.set $2
       (i32.load
        (local.get $0)
       )
      )
      (if
       (i32.eqz
        (call $strcmp
         (i32.load
          (i32.sub
           (local.get $0)
           (i32.const 4)
          )
         )
         (local.get $1)
        )
       )
       (block
        (br_if $label$1
         (local.get $6)
        )
        (br_if $label$1
         (i32.eq
          (i32.and
           (local.get $2)
           (i32.const 15)
          )
          (local.get $5)
         )
        )
       )
      )
      (local.set $0
       (i32.add
        (local.get $0)
        (i32.const 12)
       )
      )
      (br_if $label$3
       (i32.lt_s
        (local.tee $3
         (i32.add
          (local.get $3)
          (i32.const 1)
         )
        )
        (local.get $4)
       )
      )
     )
    )
   )
   (local.set $2
    (i32.const -1)
   )
  )
  (local.get $2)
 )
 (func $find_property_type (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (block $label$1
   (if
    (i32.gt_s
     (local.tee $4
      (i32.load offset=8
       (local.get $0)
      )
     )
     (i32.const 0)
    )
    (block
     (local.set $0
      (i32.add
       (local.get $0)
       (i32.const 20)
      )
     )
     (local.set $5
      (i32.eq
       (local.tee $2
        (i32.and
         (local.get $2)
         (i32.const 15)
        )
       )
       (i32.const 4)
      )
     )
     (loop $label$3
      (if
       (i32.eqz
        (call $strcmp
         (i32.load
          (i32.sub
           (local.get $0)
           (i32.const 8)
          )
         )
         (local.get $1)
        )
       )
       (block
        (br_if $label$1
         (local.get $5)
        )
        (br_if $label$1
         (i32.eq
          (i32.and
           (i32.load
            (i32.sub
             (local.get $0)
             (i32.const 4)
            )
           )
           (i32.const 15)
          )
          (local.get $2)
         )
        )
       )
      )
      (local.set $0
       (i32.add
        (local.get $0)
        (i32.const 12)
       )
      )
      (br_if $label$3
       (i32.lt_s
        (local.tee $3
         (i32.add
          (local.get $3)
          (i32.const 1)
         )
        )
        (local.get $4)
       )
      )
     )
    )
   )
   (return
    (i32.const -1)
   )
  )
  (i32.load
   (local.get $0)
  )
 )
)

