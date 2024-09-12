> todo: add DataNode tests together with a simple DSL creator

```ts
// a short scribble, way too verbose, but already implemented
DataNodeObject.newRoot().compose((create) => {
    create(DataNode, 'price', 'number', 70.25)
    create(DataNodeObject, 'checkout', 'object', {}).compose((createCheckout) => {
        createCheckout(DataNode, 'amount', 'number', 3)
    })
    // name: '${ "Surfboard " & variant.name_short }',
    // price: 70.25,
    // tags: '${ $append(["sports", "surfing"], ["color_" & $replace(variant.color, " ", "_")]) }',
    // checkout: {
    //     priceOriginal: '${ $parent()[0].price * $self().amount }',
    //     amount: 3,
})
```
