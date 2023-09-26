(module
 (type $i32_i32_i32_=>_i32 (func (param i32 i32 i32) (result i32)))
 (type $FUNCSIG$iii (func (param i32 i32) (result i32)))
 (import "env" "strcmp" (func $strcmp (type $FUNCSIG$iii) (param i32 i32) (result i32)))
 (memory $0 1)
 (export "memory" (memory $0))
 (export "find_index" (func $find_index))
 (export "find_type_by_index" (func $find_type_by_index))
 (func $find_index (type $i32_i32_i32_=>_i32) (; has Stack IR ;) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (block $label$0
   (if
    (i32.gt_s
     (local.tee $5
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
     (loop $label$2
      (local.set $4
       (i32.load
        (local.get $0)
       )
      )
      (br_if $label$0
       (i32.eqz
        (i32.or
         (call $strcmp
          (i32.load
           (i32.sub
            (local.get $0)
            (i32.const 4)
           )
          )
          (local.get $1)
         )
         (i32.and
          (i32.xor
           (local.get $2)
           (local.get $4)
          )
          (i32.const 15)
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
      (br_if $label$2
       (i32.lt_s
        (local.tee $3
         (i32.add
          (local.get $3)
          (i32.const 1)
         )
        )
        (local.get $5)
       )
      )
     )
    )
   )
   (return
    (i32.const -1)
   )
  )
  (i32.shr_u
   (local.get $4)
   (i32.const 4)
  )
 )
 (func $find_type_by_index (type $i32_i32_i32_=>_i32) (; has Stack IR ;) (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local $4 i32)
  (block $label$0
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
     (loop $label$2
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
       (br_if $label$0
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
      (local.set $0
       (i32.add
        (local.get $0)
        (i32.const 12)
       )
      )
      (br_if $label$2
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
