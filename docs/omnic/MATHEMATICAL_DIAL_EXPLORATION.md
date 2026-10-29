# Mathematical dial exploration (user source)

Exploratory context, not a finalized specification. Latest confirmed interaction rules live in OMNIC_COMPOSER.md and take precedence. In particular, base-2 slot 4 multiplication is 2*4, slot 6 recursion is 2^6, and those selected contributions sum to 72. Referenced images are not embedded in this pasted text.

""so im about tell codex to make this the nr system of omnia , at least for sliders and we expanding it slowly

so here's the idea:

12 slots visible > base 12 > each dot = 12, start from the marker, if u mark the 4th position out of 12 = 12x4, if u fill the last position = 12x12 = 144

then u have precision, u can mark 12th slot + 2nd slot for 144 + 24 and so forth

u can also deactivate the recursion, such that each slot = 1, so if u mark 12th slot = 12, then if u do 12th + 6th = 18 etc

u can also put 2 dots on a slot such that if u mark say the 3rd slot see 3rd image > u can put another above it > 3 becomes 6, and if it was base 2 > = 12

now how do u know hwat base it is at a galnce, that its 12? how to count fastest? izi: at a galnce u can do symmetry halving based until u reach 1, if u halved 8 times = 2^8 + remainder

that's also the method used to set a base, u want 96? do 2^6+32, symmetry takes care of the drawing, in fact u can just input that value, now how do u input it if ur using already the omnic-radial system rather than traditional? once each base made using the traditional u can start using the new made ones -ez

the 2nd img demonstrates this, u can even (uncertain about optimality, but its possible) put another multiplier base in the middle of the ○, such that:

edge limits:

1. compressed count at the lowest atomic lvl > see img 4, there u can't go below above base 6, cuz that's the smallest unit u can work with -max compression and efficiency, here all math systems obey the same constraints, so the highest efficiency becomes base 6, and here that right most img means: 4x4+1+2+3+5+6 (starting from top then clockwise), if u want base 12, u go like img 5, and can in fact deactive the middle to mean base recursion not activated -
2. so there are actually multiple modes: absolute middle dot activates recursion -(each dot equals the base they're circling, if the base ring is 6 > each = 6, as base, + multiplied by their position in the ring order, so 6th slot = 6x5 = value30, if u want multiple of the same, e.g multiple 4's, u fill that row outward as img 4 shows), base 1,2,3,4,56, base 12 etc.

- for it to work u need to set the start point + direction ofc. and so also means img 4 is actually recursion activated not 4x4 but base6 > 4th slot = 24, and that row has 4 activations = 24x4!, and thest of active slots multiplied by 6. if the mid slot was deactivated is when the prev math applies.

now here's the thing for the radial one outside atomnic:

we'd need to find the optimal balance between size, inside, outside to yield maximum count per mark. im not sure what it is, but what i mean is: u can rn actaully put dots INSIDE the ring, which is insane cuz then it goes absurdly exponential, like, imagine 6 dots inside, and 12 as activated recursion > if u mark 12th slot = 12x12x6 = 864 in 1 dot!, but again, to be able to do this u had to take a lot of space in the first place, so its fake, the true metric is space taken, and if the smallest mark u can do to even make a ring is 🞇, when max zoom out, u can't

why best to have each fractional precision assigned: cuz to do 24 when that slots value is 12 u need to make 2 dots, while if it had dedication 1 mark suffices. and the base ur working with will need those precisions. thus why u cant have 1 row be multiplicative of it self rather than additivie. additive wins.

see img 6 xD figured it out: given that ur componenets will be of the smallest visible unit to u then the bases and the outside must be equisized, and u must set a frame around the base + mark the start pos + read dir otherwise makes no sense unless communicate it elsewhere, so the atomic situation still relies on that, cuz if ur atoms u cant even do any of this, its only applicable to humans, but even for them who can make arbitrarily wrong rules, the fact is: they can never do it with count like saying "this equals 10000" -cheating, only the system can say it, u can specify the rules however like what each diff activates which rule/behavior, never count. the count comes from within the system. u cant say something means a certain count, unless the count came from dots in the system. else cheating. ok. now: so point is: u can make rule based marks not illegal. like the rim + direction markers + fill/empty, stuff like that -operators on relations = allowed. i mean its ultimatley also info so the less diffs they take the more optimal ur system ranks. cuz then u can make 1 thousand internal cross-count references until u settle for what a mark means > they're all included in the cost of the system. e.g 1 dot means all of the ones around it combined, no see those are marks, u can't make smaller diffs that arent part of count just to take care of recursion, bcz ur smallest marks are already the count that should take care of that cuz otherwise: ur forcing the entire of the rest of the system to take more space on each mark of the most common type. so reserving that size of operators is.. stupid. well cuz: say > = 3rd order recursion (recurse 3x) such that the ⚬○ smaller one if has that mark = 7_x7x7_ > u made each of those ⚬ 3x larger just to say that, which could've been used to give higher base. in fact: u can make that exponential by:

cuz remember it cant be arbitrary, all must be convertible between each other, obey the same rules. so u cant just have one dial have diff meanings etc. cuz then u have to make special rules for each > lose universality & convertability > cryptic. u need universal control & ability. so it must accomodate for all cases while having universal rules. so if u say that ⠒ in ○ = each dot is an exponent > u miss out on addition, such that: u cant do each dot = 2 anymore, it has to be = 4 at minimum > control lost. u also need 6,7,8 etc. cuz here's the thing: if u say that each slot = itself x it self, such that 2nd slot = 4 > then u miss the in betwen, u cant specify base 3. nor can u solve that by going outwards cuz blocked by rim, + would get absurd in in 1 axis causing absurd inefficiency, and if u try to solve it by uniquely making that statement cuz the in between irrelevant to ur system.. how would u tell it for converters/calculators? cuz then its like ppl see "24" but it actually means 102938 -makes no sense, if u've both the same radial + configs, shouldnt mean diff things cuz u made diff interpretation rules. one reads 24 as 2+4, other reads it as 2x4 -absurd, the same ⠒⠴ can be read as 5 or 6 , depending on frame mode. that's not a problem. but how do change modes economically? positions. •••••• = 6, ••• ••• = 9, ••• ^••• = exponents (each slot around the circle exponentiates it. it becomes 3(3(3)) if on 2nd slot > 27, so u need to make the diff that activates the mod. in this way, imagine if u have 12 slots, then u can mean 3^12 with a mere 4 dots. (531 444) and its universal. and u retain precision. problem: u have to walk more along 1 axis to mean smaller numbers if exponents reserved to the powerful ○. but still: u could define ur base, like ⠴, then say how many of it like ⠴(⁙) > 15, pty efficient, but, we already know 2 multiplication is the most efficient from earlier so: ⠒(⠒(⠒)) > constant doubling 8 from 6, that's 3 nests, so u can do ⠒^⠴, if that pos around ○ reserved for nesting meaning, = of 2, now u can nest even that with the 2nd dimension, each nest inherits the prev,

implication: if u have 6 axes around, u do 2^6th axis slot > 6 nests of 2x2x2.. = 2^6 = 64, at 3 space cost already.

in fact u get 9 slots around despite having to make an ○ around ⠒ to be able to actually place stuff around axis, so it goes from 6 to 9, the extra space taken from the ○ is actually returned, its not even waste. cuz then u can do 2^9(512) in at space cost of 3x. ok wait wait wait watch this wtf..

XD .. >>>> at the 2nd nesting (see img 7) order it inherits 512 as base, so u can ofc normally go 512>1024>etc, but if u activate nesting, that 512 becomes 512^512 > 10^136, in 4 x space taken. . . . . . . .. . . . .. . ........................................................................................ and with maximal control................................

now u might ask: ok how do u do 13? > many bases can do it up to base 13. that's what conversion is about. and that's what hurst the brain when it comes to math: base conversions. but yes poss, how would u do it in base 1? >13 marks. now this is the part i think u can take care of, now that u understand how the math works > check out what it takes to make diff numbers in this system across bases, ur only allowed base 1 & 2

a few other things: axes↕count, yet, to get that many axes u need.. lots of units. the minimum starter is 6.
""
